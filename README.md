# 🇵🇾 ÑandeFinanza 2.0 - Collaborative Couple Finance Tracker & AI Advisor

**ÑandeFinanza** (*"Our Finance"* in Jopara/Guaraní) is a collaborative, production-grade financial web application designed for couples to manage expenses, track debts, monitor income, and check financial health in real time. It features a localized, Jopara-speaking AI Assistant powered by DeepSeek to give friendly, context-aware financial advice following official BCP (Banco Central del Paraguay) health guidelines.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-BaaS-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![DeepSeek](https://img.shields.io/badge/AI-DeepSeek--Chat-blue?logo=openai&logoColor=white)](https://deepseek.com/)
[![PWA](https://img.shields.io/badge/PWA-Installable-FF6F00?logo=progressive-web-apps&logoColor=white)](#)

---

## ✨ Features

*   **👥 Collaborative Spaces:** Synchronized profiles under a single household space (`espacios`).
*   **💳 Pro Debts Tracker ("Deudas Pro"):** Manage credit cards, installment tracking (*cuotas*), payment percentages, and pending debt balances.
*   **📊 Interactive Financial Health Dashboard:** Recharts-powered graphs displaying joint/individual indices. Real-time warnings if the debt-to-income ratio exceeds **40%** (critical limit).
*   **🤖 Jopara AI Assistant ("ÑandeAsistente"):** A custom chat interface integrated with **DeepSeek API** via Supabase Edge Functions. It acts as an empathetic financial friend (*kape*) injecting real-time metrics and speaking in Jopara (Spanish-Guaraní hybrid).
*   **⚠️ Proactive Vencimiento Notifications:** Real-time reminders for upcoming debt due dates.
*   **📱 Progressive Web App (PWA):** Installable on iOS/Android devices for a native-like experience.
*   **📥 Excel Reports:** Direct export of financial history to Excel files (`xlsx`).

---

## 🛠️ Architecture & Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS, Lucide Icons.
- **Charts & Animations:** Recharts (responsive charting) & Framer Motion (premium micro-interactions).
- **Backend-as-a-Service (BaaS):** Supabase (PostgreSQL, Supabase Auth, Row-Level Security (RLS) policies).
- **Serverless AI Edge Functions:** Deno runtime hosted on Supabase Edge Functions connecting to the DeepSeek API.
- **Export Capabilities:** SheetJS (`xlsx`) for data extraction.

---

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18+)
*   NPM
*   A Supabase account

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/YOUR_USERNAME/app-gastos-pareja.git
    cd app-gastos-pareja
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Variables:**
    Create a `.env` file in the root directory:
    ```env
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
    ```

4.  **Database & Supabase Configuration:**
    *   Initialize Supabase and set up the schema.
    *   The SQL migration scripts are located under the [`supabase/`](file:///home/edisonubutun/app-gastos-pareja/supabase) directory. Run these in the Supabase SQL Editor.
    *   Deploy the Edge Functions and set up the `DEEPSEEK_API_KEY` secret on Supabase:
        ```bash
        supabase secrets set DEEPSEEK_API_KEY=your_deepseek_api_key
        supabase functions deploy chat-ia
        ```

5.  **Run locally:**
    ```bash
    npm run dev
    ```

---

## 🔒 Row-Level Security (RLS) & Security Details

To demonstrate production security standards, **ÑandeFinanza** enforces strict PostgreSQL RLS policies. Users can only access, modify, or insert expenses belonging to their synchronized household space (`espacio_id`). This showcases robust database-level authorization practices.

---

## 💡 AI Edge Function Implementation (DeepSeek + Jopara Context)

The AI assistant injects live metrics of the user's financial health as system instructions. Below is a snippet of how context injection and Jopara localization rules are handled in the Deno Edge Function:

```typescript
const systemInstruction = `Eres el Asistente Financiero Oficial de 'ÑandeFinanza 2.0', una aplicación de Paraguay. 
Tu rol es actuar como un 'kape' (amigo) experto en finanzas. Usa 'Jopara' natural...
Contexto financiero actual: ${JSON.stringify(contexto_financiero)}
REGLA DE ORO (Banco Central del Paraguay): Si su índice supera el 40% de su capacidad de pago, DEBES advertirle estrictamente...`;
```

---

*Desarrollado con ❤️ para organizar las finanzas del hogar.*
