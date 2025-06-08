# Receipt-Wise Ledger Pro

A smart expense tracking application that automatically processes receipt emails and manages your finances.

**Repository**: [https://github.com/jacksonkasi1/ledger.git](https://github.com/jacksonkasi1/ledger.git)

## What is this project?

Receipt-Wise Ledger Pro is a web application that helps you track expenses by automatically processing receipt emails sent to a dedicated email address. When you send receipt emails to the configured address, Postmark's inbound webhook captures them and forwards the data to our server function, which uses AI to extract expense information and updates only your personal expense records.

## How it works

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Email Receipt │───▶│  Postmark        │───▶│  Server Function│
│   (Send to      │    │  Inbound Webhook │    │  (Process Email)│
│   app email)    │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       ▼
         │                       │              ┌──────────────────┐
         │                       │              │   AI Processing  │
         │                       │              │   (Gemini AI)    │
         │                       │              │   Extract Info:  │
         │                       │              │   • Amount       │
         │                       │              │   • Vendor       │
         │                       │              │   • Date         │
         │                       │              │   • Category     │
         │                       │              └──────────────────┘
         │                       │                       │
         │                       │                       ▼
         │                       │              ┌──────────────────┐
         │                       │              │   User-Specific  │
         │                       │              │   Database       │
         │                       │              │   Update         │
         │                       │              │   (Supabase)     │
         │                       │              └──────────────────┘
         │                       │                       │
         │                       │                       ▼
         │                       │              ┌──────────────────┐
         │                       │              │   Dashboard      │
         │                       │              │   (View & Edit)  │
         │                       │              └──────────────────┘
         │                       │                       │
         │                       │                       ▼
         │                       │              ┌──────────────────┐
         │                       └─────────────▶│   Budget Alerts  │
                                                │   (Email via     │
                                                │    Postmark)     │
                                                └──────────────────┘
```

## Key Features

- **📧 Email Receipt Processing**: Send receipts to a dedicated email address for automatic processing via Postmark inbound webhooks
- **🤖 AI-Powered**: Uses Google Gemini AI to extract expense details from emails
- **👤 User-Specific Processing**: Only processes emails for the authenticated user who sent them
- **📊 Dashboard**: View monthly spending, transaction counts, and averages
- **📈 Analytics**: Track spending patterns with charts and reports
- **🏷️ Categories**: Organize expenses by type (Food, Shopping, Travel, etc.)
- **💰 Budget Alerts**: Get email notifications via Postmark when you exceed spending limits
- **📱 Responsive Design**: Works on desktop and mobile devices
- **📤 Export Data**: Download your expenses as CSV files

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **UI Components**: Radix UI + Tailwind CSS
- **Backend**: Supabase (Database + Auth + Functions)
- **AI Processing**: Google Gemini AI
- **Email Processing**: Postmark inbound webhooks
- **Email Notifications**: Postmark (for budget alerts)

## Prerequisites

To run this project, you need:

- Node.js (version 16 or higher)
- A Supabase account
- A Google Gemini AI API key
- A Postmark account (for inbound email processing and notifications)

## Quick Start

1. **Clone the project**
   ```bash
   git clone https://github.com/jacksonkasi1/ledger.git
   cd receipt-wise-ledger-pro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env`
   - Add your Supabase URL and keys
   - Add your Gemini AI API key
   - Add your Postmark credentials

4. **Run the application**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   - Go to `http://localhost:5173`
   - Sign up for an account
   - Start tracking expenses!

## How to use

1. **Sign up** for an account using your email
2. **Add expenses manually** using the dashboard
3. **Send receipt emails** to the configured app email address
4. **Watch** as Postmark's inbound webhook captures the email and triggers AI processing for your specific account
5. **View analytics** to understand your spending patterns
6. **Set budget alerts** to receive email notifications when you exceed spending limits

## Project Structure

- `src/components/` - React components (Dashboard, Analytics, etc.)
- `src/pages/` - Main application pages
- `supabase/functions/` - Backend functions for email processing
- `supabase/migrations/` - Database schema and setup

This application makes expense tracking effortless by combining modern web technologies with AI-powered automation.