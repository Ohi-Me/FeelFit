# FeelFit - Complete Deployment Guide

This guide covers all deployment options for the FeelFit Medical Analyzer platform.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Docker Deployment](#docker-deployment)
4. [Cloud Deployments](#cloud-deployments)
   - [Vercel (Frontend)](#vercel-frontend)
   - [Hugging Face Spaces (Backend)](#hugging-face-spaces-backend)
   - [Railway (Full Stack)](#railway-full-stack)
   - [AWS/GCP/Azure](#cloud-platforms)
5. [Environment Configuration](#environment-configuration)
6. [Troubleshooting](#troubleshooting)
7. [Production Checklist](#production-checklist)

---

## Prerequisites

### Required Tools
- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Python** 3.11+ ([Download](https://python.org/))
- **Git** ([Download](https://git-scm.com/))
- **Docker** (optional) ([Download](https://docker.com/))

### Required API Keys
- **Anthropic API Key** - Get from [console.anthropic.com](https://console.anthropic.com)
  - Free tier available
  - Required for AI analysis

---

## Local Development

### Step 1: Clone Repository

```bash
git clone <your-repo-url>
cd feelfit-medical-analyzer
```

### Step 2: Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
nano .env  # or use any text editor
# Add your ANTHROPIC_API_KEY

# Run development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: `http://localhost:8000`
API docs at: `http://localhost:8000/api/docs`

### Step 3: Frontend Setup

Open a new terminal:

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend will be available at: `http://localhost:3000`

### Step 4: Test the Application

1. Open `http://localhost:3000` in your browser
2. Upload a medical report (PDF/JPEG/PNG)
3. View AI-powered analysis
4. Check doctor recommendations

---

## Docker Deployment

### Quick Start with Docker Compose

```bash
# 1. Set up backend environment
cd backend
cp .env.example .env
# Edit .env and add ANTHROPIC_API_KEY
cd ..

# 2. Build and run all services
docker-compose up --build

# 3. Access services
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
# API Docs: http://localhost:8000/api/docs

# 4. Run in background
docker-compose up -d

# 5. View logs
docker-compose logs -f

# 6. Stop services
docker-compose down
```

### Individual Container Deployment

**Backend Only:**
```bash
cd backend
docker build -t feelfit-backend .
docker run -d -p 8000:8000 \
  -e ANTHROPIC_API_KEY=your_key_here \
  --name feelfit-backend \
  feelfit-backend
```

**Frontend Only:**
```bash
cd frontend
docker build -t feelfit-frontend .
docker run -d -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:8000 \
  --name feelfit-frontend \
  feelfit-frontend
```

---

## Cloud Deployments

### Vercel (Frontend)

**Best for**: Frontend hosting with automatic deployments

#### Method 1: GitHub Integration (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository
   - Configure:
     - Framework Preset: `Next.js`
     - Root Directory: `frontend`
     - Build Command: `npm run build`
     - Output Directory: `.next`
   - Add Environment Variables:
     - `NEXT_PUBLIC_API_URL` = `your-backend-url`
   - Click "Deploy"

3. **Automatic Deployments**
   - Every push to `main` triggers a deployment
   - Preview deployments for pull requests

#### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy from frontend directory
cd frontend
vercel

# Production deployment
vercel --prod
```

**Custom Domain:**
```bash
vercel domains add yourdomain.com
```

---

### Hugging Face Spaces (Backend)

**Best for**: Backend API hosting with GPU support

#### Step 1: Create Space

1. Go to [huggingface.co/spaces](https://huggingface.co/spaces)
2. Click "Create new Space"
3. Configure:
   - Name: `feelfit-backend`
   - License: `MIT`
   - SDK: `Docker`
   - Hardware: `CPU basic` (free) or `GPU T4` (paid)
   - Visibility: `Public` or `Private`

#### Step 2: Prepare Files

Create `README.md` in Space root:
```markdown
---
title: FeelFit Backend
emoji: 🏥
colorFrom: purple
colorTo: blue
sdk: docker
pinned: false
license: mit
---

# FeelFit Medical Analyzer Backend

FastAPI backend for medical report analysis.
```

#### Step 3: Upload Files

Upload these files to your Space:
- `main.py`
- `requirements.txt`
- `Dockerfile`

#### Step 4: Configure Secrets

In Space Settings → Repository secrets:
- Add `ANTHROPIC_API_KEY` = `your_api_key`

#### Step 5: Deploy

Space automatically builds and deploys. Wait 5-10 minutes.

Access: `https://huggingface.co/spaces/YOUR_USERNAME/feelfit-backend`

---

### Railway (Full Stack)

**Best for**: Complete application deployment (Frontend + Backend)

#### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

#### Step 2: Login

```bash
railway login
```

#### Step 3: Deploy Backend

```bash
cd backend

# Initialize Railway project
railway init

# Add environment variables
railway variables set ANTHROPIC_API_KEY=your_key_here
railway variables set PORT=8000

# Deploy
railway up

# Get deployment URL
railway domain
```

#### Step 4: Deploy Frontend

```bash
cd ../frontend

# Initialize new Railway project
railway init

# Add environment variables
railway variables set NEXT_PUBLIC_API_URL=your_backend_url
railway variables set PORT=3000

# Deploy
railway up

# Get deployment URL
railway domain
```

#### Management Commands

```bash
# View logs
railway logs

# View variables
railway variables

# SSH into container
railway run bash

# Delete deployment
railway down
```

---

### Cloud Platforms

#### AWS Deployment

**Option 1: AWS Elastic Beanstalk**

```bash
# Install EB CLI
pip install awsebcli

# Initialize
cd backend
eb init -p python-3.11 feelfit-backend

# Create environment
eb create feelfit-backend-env

# Deploy
eb deploy

# Frontend (separate app)
cd ../frontend
eb init -p node.js feelfit-frontend
eb create feelfit-frontend-env
eb deploy
```

**Option 2: AWS ECS (Docker)**

```bash
# Build and push to ECR
aws ecr create-repository --repository-name feelfit-backend
docker build -t feelfit-backend backend/
docker tag feelfit-backend:latest <account-id>.dkr.ecr.<region>.amazonaws.com/feelfit-backend:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/feelfit-backend:latest

# Create ECS service
aws ecs create-service --service-name feelfit-backend ...
```

#### Google Cloud Platform

```bash
# Install gcloud CLI
# https://cloud.google.com/sdk/docs/install

# Initialize
gcloud init

# Deploy backend to Cloud Run
cd backend
gcloud run deploy feelfit-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

# Deploy frontend
cd ../frontend
gcloud run deploy feelfit-frontend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### Microsoft Azure

```bash
# Install Azure CLI
# https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

# Login
az login

# Create resource group
az group create --name feelfit-rg --location eastus

# Deploy backend (Container Instances)
cd backend
az container create \
  --resource-group feelfit-rg \
  --name feelfit-backend \
  --image <your-docker-image> \
  --dns-name-label feelfit-backend \
  --ports 8000

# Deploy frontend (App Service)
cd ../frontend
az webapp up --name feelfit-frontend --runtime "NODE|18-lts"
```

---

## Environment Configuration

### Backend Environment Variables

Create `backend/.env`:

```env
# Required
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Server
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=production

# CORS (comma-separated)
ALLOWED_ORIGINS=https://yourfrontend.com,https://www.yourfrontend.com

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES=application/pdf,image/jpeg,image/png

# Security
SECRET_KEY=generate_a_secure_random_key_here

# Logging
LOG_LEVEL=INFO
```

### Frontend Environment Variables

Create `frontend/.env.local`:

```env
# API URL (required)
NEXT_PUBLIC_API_URL=https://your-backend-url.com

# App Configuration
NEXT_PUBLIC_APP_NAME=FeelFit
NEXT_PUBLIC_APP_VERSION=1.0.0

# Optional: Analytics
NEXT_PUBLIC_GA_ID=your_google_analytics_id
```

---

## Troubleshooting

### Common Issues

#### 1. Backend won't start

**Error**: `ModuleNotFoundError: No module named 'fastapi'`

**Solution**:
```bash
pip install -r requirements.txt
```

#### 2. Frontend build fails

**Error**: `Module not found: Can't resolve 'lucide-react'`

**Solution**:
```bash
npm install
# or
npm install lucide-react
```

#### 3. API connection refused

**Error**: `Failed to fetch` or `ECONNREFUSED`

**Solution**:
- Check if backend is running: `curl http://localhost:8000/api/health`
- Verify `NEXT_PUBLIC_API_URL` in frontend `.env.local`
- Check CORS settings in backend

#### 4. File upload fails

**Error**: `400 Bad Request` or `413 Payload Too Large`

**Solutions**:
- Check file type (must be PDF, JPEG, or PNG)
- Check file size (default max: 10MB)
- Verify `MAX_FILE_SIZE` in backend `.env`

#### 5. Docker build fails

**Error**: `failed to solve with frontend dockerfile.v0`

**Solutions**:
```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

#### 6. Anthropic API errors

**Error**: `401 Unauthorized` or `429 Too Many Requests`

**Solutions**:
- Verify API key is correct
- Check API key has not expired
- Review rate limits on Anthropic console
- Ensure proper billing setup

### Debug Mode

**Backend**:
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
uvicorn main:app --reload --log-level debug
```

**Frontend**:
```bash
# Enable verbose output
npm run dev -- --debug
```

---

## Production Checklist

### Security

- [ ] Change all default secret keys
- [ ] Configure specific CORS origins (not `*`)
- [ ] Enable HTTPS/TLS certificates
- [ ] Set up API rate limiting
- [ ] Implement request validation
- [ ] Add API authentication (JWT/OAuth)
- [ ] Set secure cookie flags
- [ ] Enable HSTS headers
- [ ] Regular security audits

### Performance

- [ ] Enable Redis caching
- [ ] Set up CDN (Cloudflare/CloudFront)
- [ ] Optimize images (Next.js Image component)
- [ ] Enable gzip compression
- [ ] Implement lazy loading
- [ ] Add database indexing
- [ ] Use connection pooling
- [ ] Set up load balancing

### Monitoring

- [ ] Set up error tracking (Sentry)
- [ ] Configure application monitoring (DataDog/New Relic)
- [ ] Add uptime monitoring (UptimeRobot)
- [ ] Set up log aggregation (ELK/Splunk)
- [ ] Configure alerts (PagerDuty/OpsGenie)
- [ ] Track analytics (Google Analytics)
- [ ] Monitor API usage

### Backup & Recovery

- [ ] Database backups (automated)
- [ ] Code repository backups
- [ ] Configuration backups
- [ ] Disaster recovery plan
- [ ] Incident response plan

### Documentation

- [ ] API documentation complete
- [ ] Deployment runbook
- [ ] Incident response procedures
- [ ] Architecture diagrams
- [ ] User guides

---

## Scaling

### Horizontal Scaling

**Backend**:
```bash
# Docker Swarm
docker swarm init
docker service create --replicas 3 feelfit-backend

# Kubernetes
kubectl apply -f k8s/backend-deployment.yaml
kubectl scale deployment feelfit-backend --replicas=3
```

**Frontend**:
- Vercel: Auto-scales
- AWS: Use Auto Scaling Groups
- GCP: Use Managed Instance Groups

### Vertical Scaling

**Increase Resources**:
```yaml
# docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

---

## Support & Resources

- **Documentation**: This file + README.md
- **API Docs**: `http://your-backend/api/docs`
- **Issues**: GitHub Issues
- **Email**: support@feelfit.com

---

## Quick Reference

### Useful Commands

```bash
# Frontend
npm run dev          # Development server
npm run build        # Production build
npm start            # Production server
npm run lint         # Linting

# Backend
uvicorn main:app --reload  # Development server
python -m pytest           # Run tests
black .                    # Format code
flake8 .                   # Linting

# Docker
docker-compose up -d       # Start services
docker-compose logs -f     # View logs
docker-compose down        # Stop services
docker-compose ps          # Check status

# Railway
railway up                 # Deploy
railway logs              # View logs
railway down              # Remove deployment
```

### Port Reference

- **Frontend**: 3000
- **Backend**: 8000
- **API Docs**: 8000/api/docs
- **Redis** (if used): 6379
- **PostgreSQL** (if used): 5432

---

**Deployment complete! Your FeelFit application is now live.** 🎉
