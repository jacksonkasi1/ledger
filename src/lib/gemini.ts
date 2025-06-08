
export interface ReceiptData {
  amount: number
  vendor: string
  description: string
  category: string
  date: string
}

export async function analyzeReceipt(emailContent: string): Promise<ReceiptData> {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not found in environment variables');
    throw new Error('Gemini API key is not configured. Please check your .env file.');
  }
  
  const prompt = `
    Analyze this email receipt and extract the following information in JSON format:
    - amount (number): The total amount spent
    - vendor (string): The store/company name
    - description (string): Brief description of purchase
    - category (string): One of: Food & Dining, Shopping, Transportation, Entertainment, Health & Medical, Bills & Utilities, Travel, Business, Education, Other
    - date (string): Purchase date in YYYY-MM-DD format
    
    Email content:
    ${emailContent}
    
    Return only valid JSON without any markdown formatting.
  `

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    })

    const data = await response.json()
    const generatedText = data.candidates[0].content.parts[0].text
    
    // Clean up the response and parse JSON
    const cleanedText = generatedText.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(cleanedText)
  } catch (error) {
    console.error('Error analyzing receipt:', error)
    // Return default values if AI fails
    return {
      amount: 0,
      vendor: 'Unknown',
      description: 'Receipt processing failed',
      category: 'Other',
      date: new Date().toISOString().split('T')[0]
    }
  }
}
