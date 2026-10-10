// gemini_api_example.js
// Example of how to call the Google Gemini API from JavaScript (Node.js)
// This script sends a prompt "Write a love letter" to the Gemini model and prints the response.
//
// Prerequisites:
//   1. Node.js installed (v18+ recommended for native fetch support).
//   2. A Google AI Studio API key with access to the Gemini models.
//   3. (Optional) Install the "dotenv" package if you want to store the API key in a .env file.
//
// Usage:
//   node gemini_api_example.js
//
// If you store your API key in a .env file, create a .env file with:
//   GEMINI_API_KEY=your_api_key_here
// Then run: npm install dotenv (once) and the script will load the key automatically.

// ------------------------------------------------------------
// Load environment variables (optional)
let apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  // If not using .env, you can directly assign your key here (not recommended for production).
  // apiKey = "YOUR_API_KEY_HERE";
  console.error("Error: GEMINI_API_KEY not set. Set it in the environment or .env file.");
  process.exit(1);
}

// Define the request payload for Gemini's generateContent endpoint.
const payload = {
  contents: [
    {
      role: "user",
      parts: [
        { text: "Write a love letter" }
      ]
    }
  ]
};

// The Gemini model we will use. "gemini-pro" is the default chat model.
const model = "gemini-pro";

// Build the full endpoint URL with the API key.
const endpoint = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

// Async function to call the API.
async function generateLoveLetter() {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    // The generated text is located in data.candidates[0].content.parts[0].text
    const generated = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log("--- Generated Love Letter ---\n");
    console.log(generated ?? "No text returned.");
  } catch (err) {
    console.error("Error calling Gemini API:", err.message);
  }
}

// Run the function.
generateLoveLetter();
