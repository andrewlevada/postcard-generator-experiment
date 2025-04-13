import React from 'react';
import { createRoot } from 'react-dom/client';
import { POSTCARD_PROMPT } from './prompt';

interface FormData {
  theme: string;
  name: string;
  imageFile: File | null;
}

async function generatePostcardInstruction(data: FormData, apiToken: string): Promise<string> {
  const prompt = POSTCARD_PROMPT
    .replace('{theme}', data.theme)
    .replace('{name}', data.name);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({
      model: 'openai/gpt-4',
      temperature: 1.1,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.choices[0].message.content;
}

async function generatePoem(theme: string, name: string): Promise<string> {
  const url = `https://andrewlevada--poem-generator-poemgenerator-generate-poem.modal.run/?theme=${encodeURIComponent(theme)}&title=${encodeURIComponent(name)}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Poem API call failed: ${response.statusText}`);
  }
  
  const result = await response.json();
  const poem = result.poem || '';
  return poem.replace(/\n\n/g, '\n');
}

export function App() {
  const [formData, setFormData] = React.useState<FormData>({
    theme: 'День рождения',
    name: 'Кот Крыжовник',
    imageFile: null
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [apiToken, setApiToken] = React.useState<string>("");

  React.useEffect(() => {
    window.addEventListener('message', (e) => {
      const { type, apiToken } = e.data.pluginMessage;
      if (type === 'api-token') {
        setApiToken(apiToken);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let imageUrl = '';
      if (formData.imageFile) {
        // Convert the file to a data URL
        imageUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(formData.imageFile as Blob);
        });
      }

      // Fetch both the postcard instruction and the poem in parallel
      const [instruction, poemText] = await Promise.all([
        generatePostcardInstruction(formData, apiToken),
        generatePoem(formData.theme, formData.name)
      ]);
      
      // Parse the instruction
      const parsedInstruction = JSON.parse(instruction);

      if (poemText) {
        parsedInstruction.body = { ...parsedInstruction.body, text: poemText };
      }

      if (imageUrl) {
        parsedInstruction.picture = { 
          ...parsedInstruction.picture,
          url: imageUrl
        };
      }
      
      parent.postMessage({ 
        pluginMessage: { 
          type: 'create-postcard',
          instruction: parsedInstruction
        }
      }, '*');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      maxWidth: '300px',
      margin: '0 auto'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ textAlign: 'center', width: '100%' }} htmlFor="theme">Celebration Theme:</label>
        <input
          id="theme"
          type="text"
          value={formData.theme}
          onChange={(e) => setFormData(prev => ({ ...prev, theme: e.target.value }))}
          required
          style={{
            padding: '8px',
            borderRadius: '12px',
            border: '1px solid #ccc'
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ textAlign: 'center', width: '100%' }} htmlFor="name">Person's Name:</label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
          style={{
            padding: '8px',
            borderRadius: '12px',
            border: '1px solid #ccc'
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ textAlign: 'center', width: '100%' }} htmlFor="image">Upload Image:</label>
        <input
          id="image"
          type="file"
          accept="image/*"
          onChange={(e) => setFormData(prev => ({ ...prev, imageFile: e.target.files?.[0] || null }))}
          style={{
            padding: '8px',
            borderRadius: '12px',
            border: '1px solid #ccc'
          }}
        />
      </div>

      <button 
        type="submit" 
        disabled={loading}
        style={{
          padding: '8px 16px',
          marginTop: '8px',
          borderRadius: '12px',
          border: 'none',
          backgroundColor: loading ? '#AAAAAA' : '#18A0FB',
          color: 'white',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Hold on a sec...' : 'Make a postcard ✨'}
      </button>

      {error && (
        <div className="error" style={{ color: 'red', marginTop: '8px' }}>
          {error}
        </div>
      )}
    </form>
  );
}

// Mount the React component
const container = document.getElementById('react-page');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
} 