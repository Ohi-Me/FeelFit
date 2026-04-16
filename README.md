# FeelFit - Advanced Medical Report Analyzer

<div align="center">

![FeelFit Logo](https://img.shields.io/badge/FeelFit-Medical_Intelligence-8B5CF6?style=for-the-badge)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

**AI-Powered Medical Report Analysis with NLP & Computer Vision**

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Deployment](#-deployment)

</div>

---

## 🎯 Overview

FeelFit is a cutting-edge medical report analyzer that leverages advanced AI technologies (Claude Sonnet 4) to provide comprehensive medical insights. The platform combines Natural Language Processing (NLP) and Computer Vision to analyze medical reports, extract key information, and provide personalized health recommendations along with specialist suggestions based on location.

### 🌟 Key Highlights

- **AI-Powered Analysis**: State-of-the-art Claude Sonnet 4 model
- **Multi-Format Support**: PDF, JPEG, PNG medical reports
- **Real-Time Processing**: Fast analysis with instant results
- **Location-Based Doctors**: Find specialists near you
- **Premium UI/UX**: Dark/light mode with smooth animations
- **Professional Architecture**: Separate frontend (Next.js) and backend (FastAPI)

---

## ✨ Features

### 🔬 Medical Analysis
- **Comprehensive Report Processing**: Supports PDF documents and images
- **Test Result Interpretation**: Automated analysis with normal/abnormal flagging
- **Diagnosis Generation**: AI-powered medical insights
- **Severity Assessment**: Risk level evaluation
- **Key Findings Extraction**: Important highlights from reports

### 💊 Health Recommendations
- **Personalized Prescriptions**: Medication details with dosage
- **Lifestyle Advice**: Customized health tips
- **Follow-up Care**: Scheduled monitoring recommendations
- **Preventive Measures**: Proactive health guidance

### 🏥 Doctor Finder
- **Location-Based Search**: GPS-powered specialist discovery
- **Rating System**: Top-rated doctors first
- **Comprehensive Details**: Experience, fees, availability
- **Contact Integration**: Direct appointment booking
- **Distance Calculation**: Find nearest specialists

### 🎨 Premium Design
- **Modern UI**: Clean, elegant interface with Playfair Display & Inter fonts
- **Dark/Light Mode**: Seamless theme switching
- **Smooth Animations**: CSS-powered micro-interactions
- **Responsive Design**: Perfect on all devices
- **Real-Time Clock**: IST timezone with date display
- **Gradient Overlays**: Subtle animated backgrounds

---

## 🏗️ Architecture

```
feelfit-medical-analyzer/
├── frontend/                 # Next.js 14 Frontend
│   ├── app/
│   │   ├── page.jsx         # Main application component
│   │   └── layout.jsx       # Root layout with metadata
│   ├── package.json
│   ├── next.config.js
│   └── .gitignore
│
├── backend/                  # FastAPI Backend
│   ├── main.py              # API server with endpoints
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile           # Container configuration
│   ├── .env.example         # Environment template
│   └── .gitignore
│
├── README.md                # This file
├── DEPLOYMENT.md            # Deployment guide
└── docker-compose.yml       # Multi-container setup
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.11+ (for backend)
- **Docker** (optional, for containerization)
- **Anthropic API Key** ([Get one here](https://console.anthropic.com))

### Option 1: Local Development

#### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: `http://localhost:3000`

#### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Run server
uvicorn main:app --reload
```

Backend API runs on: `http://localhost:8000`

API Documentation: `http://localhost:8000/api/docs`

### Option 2: Docker Compose

```bash
# Create .env file in backend directory
cd backend
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# Return to root and run
cd ..
docker-compose up --build
```

Services:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- API Docs: `http://localhost:8000/api/docs`

---

## 📖 Documentation

### Frontend (Next.js)

#### Project Structure
```
frontend/
├── app/
│   ├── page.jsx          # Main React component
│   ├── layout.jsx        # App layout with metadata
│   └── globals.css       # Global styles (if needed)
├── public/               # Static assets
├── package.json          # Dependencies
└── next.config.js        # Next.js configuration
```

#### Key Technologies
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Icons**: Lucide React
- **Styling**: CSS-in-JS (styled with template literals)
- **Fonts**: Google Fonts (Playfair Display, Inter)

#### Features
- Server-side rendering (SSR)
- Client-side navigation
- Optimized images
- SEO-friendly metadata
- Real-time clock with IST timezone
- Geolocation API integration

### Backend (FastAPI)

#### API Endpoints

**Health Check**
```bash
GET /api/health
```

**Analyze Report**
```bash
POST /api/analyze
Content-Type: multipart/form-data
Body: file (PDF/JPEG/PNG)
```

**Find Doctors**
```bash
POST /api/doctors
Content-Type: application/json
Body: {
  "specialization": "Cardiology",
  "location": {"lat": 30.9010, "lng": 75.8573}
}
```

**API Info**
```bash
GET /api/info
```

#### Response Format

**Analysis Response**:
```json
{
  "reportType": "Blood Test",
  "patientInfo": {
    "name": "John Doe",
    "age": "35",
    "gender": "Male"
  },
  "testResults": [
    {
      "test": "Hemoglobin",
      "value": "14.5 g/dL",
      "normalRange": "13.5-17.5 g/dL",
      "status": "normal"
    }
  ],
  "keyFindings": ["All parameters within normal range"],
  "diagnosis": "Healthy individual",
  "severity": "low",
  "recommendations": ["Maintain current lifestyle"],
  "prescriptions": [],
  "lifestyle": ["Regular exercise", "Balanced diet"],
  "followUp": "Annual checkup recommended",
  "specialization": "General Physician",
  "urgency": "routine"
}
```

---

## 🌐 Deployment

### Vercel (Frontend)

1. Push code to GitHub
2. Import project on [Vercel](https://vercel.com)
3. Configure:
   - Framework: Next.js
   - Root Directory: `frontend`
   - Build Command: `npm run build`
4. Deploy!

### Hugging Face Spaces (Backend)

1. Create new Space with Docker SDK
2. Upload backend files
3. Add `ANTHROPIC_API_KEY` in Settings → Secrets
4. Space automatically builds and deploys

### Railway (Full Stack)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy backend
cd backend
railway init
railway up

# Deploy frontend
cd ../frontend
railway init
railway up
```

### Docker Deployment

```bash
# Build images
docker-compose build

# Run containers
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 🔧 Configuration

### Frontend Environment Variables

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=FeelFit
```

### Backend Environment Variables

Edit `backend/.env`:

```env
ANTHROPIC_API_KEY=your_api_key_here
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=production
ALLOWED_ORIGINS=https://yourfrontend.com
```

---

## 🧪 Testing

### Frontend Tests

```bash
cd frontend
npm run lint
npm run build  # Test build
```

### Backend Tests

```bash
cd backend
pytest
pytest --cov=main tests/
```

### API Testing

Use the interactive docs: `http://localhost:8000/api/docs`

Or test with curl:

```bash
# Health check
curl http://localhost:8000/api/health

# Analyze report
curl -X POST http://localhost:8000/api/analyze \
  -F "file=@report.pdf"
```

---

## 📊 Performance

- **Frontend Load Time**: < 2s
- **API Response Time**: < 3s
- **File Processing**: < 5s for most reports
- **Uptime Target**: 99.9%

### Optimization Tips

1. **Frontend**:
   - Enable Next.js image optimization
   - Use lazy loading for images
   - Implement code splitting

2. **Backend**:
   - Add Redis caching
   - Implement rate limiting
   - Use connection pooling

---

## 🔒 Security

### Best Practices Implemented

✅ HTTPS/TLS encryption
✅ CORS configuration
✅ Input validation
✅ File type verification
✅ Size limits on uploads
✅ Environment variable protection
✅ API key security
✅ Error handling without leaks

