# Dollar Invest (달러인베스트)

A comprehensive web application for managing USD/KRW currency investments.

## Overview

A personal finance tool designed for Korean investors to track, analyze, and manage their US dollar holdings with real-time exchange rate monitoring and brokerage integration.

## Key Features

### Dashboard
- Real-time USD/KRW exchange rate display
- Portfolio overview with profit/loss calculations
- Interactive TradingView-style charts

### Exchange Rates
- Live rates for major currencies (USD, EUR, JPY, CNY, GBP)
- Historical rate charts (30-day trends)
- Rate change alerts and notifications

### Portfolio Management
- Multiple portfolio support
- Average buy rate tracking
- Realized/unrealized P&L calculations
- Manual and automatic transaction logging

### Smart Alerts
- Target rate notifications
- Daily rate update alerts
- Percentage change alerts

### Brokerage Integration
- **Hana Securities**: Windows desktop bridge (Python) for 1Q Open API
- **Korea Investment & Securities (KIS)**: REST API integration
- Manual mode for offline tracking

### User Management
- Role-based access control (User, Admin, Super Admin)
- Pro subscription features
- Account suspension/activation

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS v4
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: SQLite (development) / PostgreSQL (production)
- **Auth**: NextAuth.js v5
- **Charts**: lightweight-charts v5

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/dollar-invest.git
cd dollar-invest

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Initialize database
npx prisma db push

# Run development server
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Exchange Rate API (optional)
KOREAEXIM_API_KEY="your-api-key"

# Korea Investment Securities API (optional)
KIS_APP_KEY="your-app-key"
KIS_APP_SECRET="your-app-secret"
```

## PC Bridge (Hana Securities)

For Hana Securities integration, a separate Python desktop application is required.

See [dollar-invest-bridge/README.md](../dollar-invest-bridge/README.md) for setup instructions.

## Project Structure

```
dollar-invest/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── admin/        # Admin dashboard
│   │   ├── alerts/       # Alert management
│   │   ├── api/          # API routes
│   │   ├── broker/       # Brokerage connection
│   │   ├── exchange/     # Exchange rates
│   │   ├── portfolio/    # Portfolio management
│   │   ├── settings/     # User settings
│   │   └── trade/        # Trading
│   ├── components/       # React components
│   │   ├── layout/       # Header, Footer
│   │   ├── exchange/     # Exchange rate components
│   │   ├── portfolio/    # Portfolio components
│   │   └── ui/           # UI primitives
│   ├── lib/              # Utility functions
│   └── stores/           # Zustand stores
├── prisma/
│   └── schema.prisma     # Database schema
└── public/               # Static assets
```

## License

MIT License

## Author

Built with Next.js and Prisma
