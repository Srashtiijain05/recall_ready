import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recall Developer Documentation</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
            'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
            sans-serif;
          color: #333;
          background: #f9f9f9;
          line-height: 1.6;
        }
        
        header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 60px 20px;
          text-align: center;
        }
        
        header h1 {
          font-size: 48px;
          margin-bottom: 10px;
        }
        
        header p {
          font-size: 18px;
          opacity: 0.95;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 30px;
          margin: 40px 0;
        }
        
        .card {
          background: white;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: all 0.3s ease;
        }
        
        .card:hover {
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          transform: translateY(-4px);
        }
        
        .card h3 {
          color: #667eea;
          margin-bottom: 15px;
          font-size: 20px;
        }
        
        .card p {
          color: #666;
          margin-bottom: 15px;
        }
        
        .card a {
          color: #667eea;
          text-decoration: none;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        
        .card a:hover {
          text-decoration: underline;
        }
        
        .section {
          margin: 40px 0;
        }
        
        .section h2 {
          color: #667eea;
          margin-bottom: 20px;
          font-size: 24px;
          border-bottom: 2px solid #667eea;
          padding-bottom: 10px;
        }
        
        .code-block {
          background: #f5f5f5;
          border-left: 4px solid #667eea;
          padding: 15px;
          margin: 15px 0;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          overflow-x: auto;
          font-size: 13px;
        }
        
        .endpoint-item {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin: 15px 0;
          border-left: 4px solid #667eea;
        }
        
        .method {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          margin-right: 10px;
        }
        
        .method.post {
          background: #10b981;
          color: white;
        }
        
        .method.get {
          background: #3b82f6;
          color: white;
        }
        
        .method.delete {
          background: #ef4444;
          color: white;
        }
        
        .endpoint-path {
          font-family: monospace;
          color: #667eea;
          font-weight: 600;
        }
        
        .tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        
        .tab {
          padding: 10px 15px;
          cursor: pointer;
          border: none;
          background: none;
          font-size: 14px;
          font-weight: 500;
          color: #666;
          border-bottom: 3px solid transparent;
          margin-bottom: -2px;
        }
        
        .tab.active {
          color: #667eea;
          border-bottom-color: #667eea;
        }
        
        .tab-content {
          display: none;
        }
        
        .tab-content.active {
          display: block;
        }
        
        footer {
          background: #f5f5f5;
          padding: 30px 20px;
          text-align: center;
          color: #666;
          margin-top: 40px;
        }
      </style>
    </head>
    <body>
      <header>
        <h1>🚀 Recall API Documentation</h1>
        <p>Integrate RAG capabilities into your application</p>
      </header>
      
      <div class="container">
        <!-- Quick Start -->
        <div class="section">
          <h2>⚡ Quick Start</h2>
          
          <div class="grid">
            <div class="card">
              <h3>1. Get Your API Key</h3>
              <p>Sign up and generate an API key from your dashboard. Your key starts with <code>sk_live_</code></p>
            </div>
            
            <div class="card">
              <h3>2. Get a Token</h3>
              <p>Use your API key to get a short-lived JWT token (1 hour expiry)</p>
              <div class="code-block">curl -X POST https://api.recall.ai/api/v1/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{"api_key": "sk_live_xxx"}'</div>
            </div>
            
            <div class="card">
              <h3>3. Make API Calls</h3>
              <p>Use your token to authenticate subsequent requests</p>
              <div class="code-block">curl -H "Authorization: Bearer {token}" \\
  https://api.recall.ai/api/v1/projects</div>
            </div>
          </div>
        </div>
        
        <!-- Core Concepts -->
        <div class="section">
          <h2>📚 Core Concepts</h2>
          
          <div class="grid">
            <div class="card">
              <h3>🗂️ Projects</h3>
              <p>Organize your RAG data. Each project is a container for files and chats.</p>
              <a href="#projects">Learn more →</a>
            </div>
            
            <div class="card">
              <h3>📄 Files</h3>
              <p>Upload documents (PDF, DOC, TXT) to your project for RAG processing.</p>
              <a href="#files">Learn more →</a>
            </div>
            
            <div class="card">
              <h3>💬 Chat</h3>
              <p>Query your data with RAG. Get answers with sources.</p>
              <a href="#chat">Learn more →</a>
            </div>
          </div>
        </div>
        
        <!-- API Endpoints -->
        <div class="section">
          <h2>🔌 API Endpoints</h2>
          
          <div id="projects">
            <h3 style="margin-top: 30px; margin-bottom: 15px; color: #667eea;">Projects API</h3>
            
            <div class="endpoint-item">
              <span class="method post">POST</span>
              <span class="endpoint-path">/api/v1/projects</span>
              <p style="margin-top: 10px;">Create a new project</p>
              <div class="code-block">{
  "name": "Support Chat"
}</div>
            </div>
            
            <div class="endpoint-item">
              <span class="method get">GET</span>
              <span class="endpoint-path">/api/v1/projects</span>
              <p style="margin-top: 10px;">List all projects</p>
            </div>
            
            <div class="endpoint-item">
              <span class="method get">GET</span>
              <span class="endpoint-path">/api/v1/projects/{id}</span>
              <p style="margin-top: 10px;">Get a specific project</p>
            </div>
            
            <div class="endpoint-item">
              <span class="method delete">DELETE</span>
              <span class="endpoint-path">/api/v1/projects/{id}</span>
              <p style="margin-top: 10px;">Delete a project</p>
            </div>
          </div>
          
          <div id="files">
            <h3 style="margin-top: 30px; margin-bottom: 15px; color: #667eea;">Files API</h3>
            
            <div class="endpoint-item">
              <span class="method post">POST</span>
              <span class="endpoint-path">/api/v1/projects/{id}/files</span>
              <p style="margin-top: 10px;">Upload a file (multipart/form-data)</p>
            </div>
            
            <div class="endpoint-item">
              <span class="method get">GET</span>
              <span class="endpoint-path">/api/v1/projects/{id}/files</span>
              <p style="margin-top: 10px;">List files in a project</p>
            </div>
            
            <div class="endpoint-item">
              <span class="method delete">DELETE</span>
              <span class="endpoint-path">/api/v1/files/{fileId}</span>
              <p style="margin-top: 10px;">Delete a file</p>
            </div>
          </div>
          
          <div id="chat">
            <h3 style="margin-top: 30px; margin-bottom: 15px; color: #667eea;">Chat API (RAG Core)</h3>
            
            <div class="endpoint-item">
              <span class="method post">POST</span>
              <span class="endpoint-path">/api/v1/chat</span>
              <p style="margin-top: 10px;">Send a message and get RAG response</p>
              <div class="code-block">{
  "project_id": "proj_123",
  "message": "What is your refund policy?",
  "chat_id": "optional"
}</div>
            </div>
            
            <div class="endpoint-item">
              <span class="method get">GET</span>
              <span class="endpoint-path">/api/v1/chats</span>
              <p style="margin-top: 10px;">List all chats</p>
            </div>
            
            <div class="endpoint-item">
              <span class="method get">GET</span>
              <span class="endpoint-path">/api/v1/chats/{id}</span>
              <p style="margin-top: 10px;">Get chat with full message history</p>
            </div>
            
            <div class="endpoint-item">
              <span class="method delete">DELETE</span>
              <span class="endpoint-path">/api/v1/chats/{id}</span>
              <p style="margin-top: 10px;">Delete a chat</p>
            </div>
          </div>
        </div>
        
        <!-- Authentication -->
        <div class="section">
          <h2>🔐 Authentication</h2>
          
          <h3 style="margin: 20px 0 15px 0; color: #667eea;">API Key Authentication</h3>
          <p>Use your API key directly for authentication:</p>
          <div class="code-block">curl -H "Authorization: Bearer sk_live_xxx" \\
  https://api.recall.ai/api/v1/projects</div>
          
          <h3 style="margin: 20px 0 15px 0; color: #667eea;">Token-Based Authentication</h3>
          <p>For better security, exchange your API key for a token:</p>
          <div class="code-block">curl -X POST https://api.recall.ai/api/v1/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{"api_key": "sk_live_xxx"}'</div>
          <p style="margin-top: 10px;">Then use the token:</p>
          <div class="code-block">curl -H "Authorization: Bearer {jwt_token}" \\
  https://api.recall.ai/api/v1/projects</div>
        </div>
        
        <!-- Error Handling -->
        <div class="section">
          <h2>⚠️ Error Handling</h2>
          
          <p>All errors follow a standard format:</p>
          <div class="code-block">{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again later."
  }
}</div>
          
          <h3 style="margin: 20px 0 15px 0; color: #667eea;">Error Codes</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr style="background: #f5f5f5;">
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Code</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Meaning</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">HTTP Status</th>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">UNAUTHORIZED</td>
              <td style="padding: 10px; border: 1px solid #ddd;">Invalid API key or token</td>
              <td style="padding: 10px; border: 1px solid #ddd;">401</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">FORBIDDEN</td>
              <td style="padding: 10px; border: 1px solid #ddd;">No permission to access</td>
              <td style="padding: 10px; border: 1px solid #ddd;">403</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">NOT_FOUND</td>
              <td style="padding: 10px; border: 1px solid #ddd;">Resource not found</td>
              <td style="padding: 10px; border: 1px solid #ddd;">404</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">RATE_LIMITED</td>
              <td style="padding: 10px; border: 1px solid #ddd;">Too many requests</td>
              <td style="padding: 10px; border: 1px solid #ddd;">429</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">INTERNAL_ERROR</td>
              <td style="padding: 10px; border: 1px solid #ddd;">Server error</td>
              <td style="padding: 10px; border: 1px solid #ddd;">500</td>
            </tr>
          </table>
        </div>
        
        <!-- Rate Limiting -->
        <div class="section">
          <h2>⏱️ Rate Limiting</h2>
          
          <p>Default rate limits per API key:</p>
          <ul style="margin-left: 20px; margin-top: 10px;">
            <li><strong>General requests:</strong> 100 requests/minute</li>
            <li><strong>Chat requests:</strong> 30 requests/minute</li>
          </ul>
          
          <p style="margin-top: 20px;">When rate limited, you'll receive a 429 response:</p>
          <div class="code-block">{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again later."
  }
}</div>
        </div>
        
        <!-- Resources -->
        <div class="section">
          <h2>📖 Resources</h2>
          
          <div class="grid">
            <div class="card">
              <h3>📚 Full API Reference</h3>
              <p>See complete endpoint documentation with examples</p>
              <a href="/api/v1/docs">Open Swagger UI →</a>
            </div>
            
            <div class="card">
              <h3>📮 Postman Collection</h3>
              <p>Import our Postman collection for easy testing</p>
              <a href="/api/postman-collection.json">Download JSON →</a>
            </div>
            
            <div class="card">
              <h3>💬 Support</h3>
              <p>Need help? Contact our support team</p>
              <a href="https://support.recall.ai">Get Help →</a>
            </div>
          </div>
        </div>
      </div>
      
      <footer>
        <p>© 2024 Recall. All rights reserved. | <a href="#" style="color: #667eea; text-decoration: none;">Terms</a> | <a href="#" style="color: #667eea; text-decoration: none;">Privacy</a></p>
      </footer>
    </body>
    </html>
  `;

    return new NextResponse(html, {
        headers: {
            "Content-Type": "text/html",
        },
    });
}
