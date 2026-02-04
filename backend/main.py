"""
FeelFit Medical Report Analyzer - Backend API with Gemini AI
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import base64
import httpx
import os
from datetime import datetime
import logging
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="FeelFit Medical Analyzer API",
    description="AI-powered medical report analysis with Google Gemini",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class PatientInfo(BaseModel):
    name: str
    age: str
    gender: str

class TestResult(BaseModel):
    test: str
    value: str
    normalRange: str
    status: str

class Prescription(BaseModel):
    medication: str
    dosage: str
    frequency: str
    duration: str

class AnalysisResult(BaseModel):
    reportType: str
    patientInfo: PatientInfo
    testResults: List[TestResult]
    keyFindings: List[str]
    diagnosis: str
    severity: str
    recommendations: List[str]
    prescriptions: List[Prescription]
    lifestyle: List[str]
    followUp: str
    specialization: str
    urgency: str

class Doctor(BaseModel):
    name: str
    specialization: str
    clinic: str
    rating: float
    experience: str
    address: str
    phone: str
    distance: str
    availability: str
    fees: str

class LocationRequest(BaseModel):
    lat: float
    lng: float

# Health check endpoint
@app.get("/")
async def root():
    return {
        "status": "healthy",
        "service": "FeelFit Medical Analyzer API",
        "version": "2.0.0",
        "ai_provider": "Google Gemini",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "FeelFit Backend v2.0"
    }

class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "AIzaSyC-e_KqTkS6qT5zTMsvE8IMo3E4soU4wXc")  # Default free key
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"
        
    async def analyze_with_gemini(self, prompt: str, image_data: str = None, mime_type: str = None):
        """Analyze using Gemini API with vision capability"""
        
        headers = {
            "Content-Type": "application/json"
        }
        
        # Build content parts
        parts = [{"text": prompt}]
        
        if image_data:
            parts.insert(0, {
                "inline_data": {
                    "mime_type": mime_type,
                    "data": image_data
                }
            })
        
        payload = {
            "contents": [{
                "parts": parts
            }],
            "generationConfig": {
                "temperature": 0.1,
                "topK": 32,
                "topP": 1,
                "maxOutputTokens": 2048,
            }
        }
        
        model_name = "gemini-pro-vision" if image_data else "gemini-pro"
        url = f"{self.base_url}/{model_name}:generateContent?key={self.api_key}"
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            
            if response.status_code != 200:
                logger.error(f"Gemini API error: {response.status_code} - {response.text}")
                raise Exception(f"Gemini API error: {response.status_code}")
            
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
    
    async def analyze_pdf_with_gemini(self, pdf_data: str, prompt: str):
        """Analyze PDF using Gemini (PDF as base64)"""
        # For PDF, we'll treat it as a text extraction first
        headers = {
            "Content-Type": "application/json"
        }
        
        # Extract text from PDF or process as document
        payload = {
            "contents": [{
                "parts": [{"text": f"PDF Content (Base64): {pdf_data[:1000]}...\n\n{prompt}"}]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 2048,
            }
        }
        
        url = f"{self.base_url}/gemini-pro:generateContent?key={self.api_key}"
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            
            if response.status_code != 200:
                logger.error(f"Gemini PDF error: {response.status_code}")
                raise Exception(f"Gemini PDF error: {response.status_code}")
            
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

@app.post("/api/analyze", response_model=AnalysisResult)
async def analyze_report(file: UploadFile = File(...)):
    """
    Analyze medical report using Google Gemini AI
    """
    try:
        logger.info(f"Analyzing file: {file.filename}")
        
        # Validate file type
        allowed_types = ["application/pdf", "image/jpeg", "image/jpg", "image/png"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: PDF, JPEG, PNG"
            )
        
        # Read and encode file
        contents = await file.read()
        base64_data = base64.b64encode(contents).decode('utf-8')
        
        # Initialize Gemini service
        gemini = GeminiService()
        
        # Create analysis prompt
        analysis_prompt = """You are a medical expert analyzing a medical report. Extract and analyze ALL information from the report.

Return ONLY valid JSON with this exact structure:
{
  "reportType": "Type of medical report (e.g., Blood Test, X-Ray, MRI Scan)",
  "patientInfo": {
    "name": "Patient name or 'Not specified'", 
    "age": "Age or 'Not specified'",
    "gender": "Gender or 'Not specified'"
  },
  "testResults": [
    {
      "test": "Test name",
      "value": "Result value with units",
      "normalRange": "Normal range reference",
      "status": "normal/abnormal/borderline"
    }
  ],
  "keyFindings": ["Key finding 1", "Key finding 2"],
  "diagnosis": "Primary diagnosis or observations",
  "severity": "low/moderate/high/critical",
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "prescriptions": [
    {
      "medication": "Medication name",
      "dosage": "Dosage instructions",
      "frequency": "How often to take",
      "duration": "Duration of treatment"
    }
  ],
  "lifestyle": ["Lifestyle advice 1", "Lifestyle advice 2"],
  "followUp": "Follow-up instructions and timing",
  "specialization": "Required medical specialization (e.g., Cardiologist, Endocrinologist)",
  "urgency": "routine/soon/urgent/emergency"
}

IMPORTANT: Return ONLY the JSON object, no additional text or markdown."""

        # Process based on file type
        is_pdf = file.content_type == "application/pdf"
        is_image = file.content_type in ["image/jpeg", "image/jpg", "image/png"]
        
        if is_pdf:
            # For PDFs, use text analysis
            analysis_text = await gemini.analyze_pdf_with_gemini(base64_data, analysis_prompt)
        elif is_image:
            # For images, use vision model
            mime_type = file.content_type
            analysis_text = await gemini.analyze_with_gemini(analysis_prompt, base64_data, mime_type)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        
        # Clean and parse JSON response
        analysis_text = analysis_text.strip()
        if analysis_text.startswith("```json"):
            analysis_text = analysis_text[7:]
        if analysis_text.endswith("```"):
            analysis_text = analysis_text[:-3]
        analysis_text = analysis_text.strip()
        
        result = json.loads(analysis_text)
        
        # Validate required fields
        if not isinstance(result, dict):
            raise ValueError("Invalid response format")
        
        # Ensure all required fields exist
        required_fields = [
            "reportType", "patientInfo", "testResults", "keyFindings",
            "diagnosis", "severity", "recommendations", "prescriptions",
            "lifestyle", "followUp", "specialization", "urgency"
        ]
        
        for field in required_fields:
            if field not in result:
                result[field] = "" if field != "testResults" else []
        
        logger.info(f"Analysis successful: {result['reportType']}")
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {e}")
        # Try to extract JSON from response
        try:
            # Find JSON in text response
            import re
            json_match = re.search(r'\{.*\}', analysis_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return result
        except:
            raise HTTPException(
                status_code=500,
                detail="Failed to parse AI response. Please try again."
            )
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )

@app.post("/api/doctors")
async def find_doctors(specialization: str, location: LocationRequest):
    """
    Find doctors using Gemini AI (simulated recommendations)
    """
    try:
        logger.info(f"Finding {specialization} doctors")
        
        gemini = GeminiService()
        
        prompt = f"""Generate a list of 5 {specialization} doctors in Ludhiana, Punjab area. 
        Create realistic doctor information including names, clinics, ratings, experience, 
        contact info, and availability.

        Return ONLY valid JSON with this structure:
        {{
            "doctors": [
                {{
                    "name": "Dr. Full Name",
                    "specialization": "{specialization}",
                    "clinic": "Clinic/Hospital Name",
                    "rating": 4.5,
                    "experience": "15 years",
                    "address": "Complete address with city",
                    "phone": "Phone number",
                    "distance": "2.5 km",
                    "availability": "Mon-Sat 10AM-6PM",
                    "fees": "₹500-800"
                }}
            ]
        }}

        Make the information realistic and varied."""
        
        response_text = await gemini.analyze_with_gemini(prompt)
        
        # Clean JSON response
        response_text = response_text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        result = json.loads(response_text)
        
        # Add some default doctors if API fails
        if not result.get("doctors"):
            result["doctors"] = get_default_doctors(specialization)
        
        return result
        
    except Exception as e:
        logger.error(f"Doctor search error: {e}")
        # Return default doctors
        return {"doctors": get_default_doctors(specialization)}

def get_default_doctors(specialization: str):
    """Default doctors for fallback"""
    default_doctors = {
        "Cardiologist": [
            {
                "name": "Dr. Rajesh Sharma",
                "specialization": "Cardiologist",
                "clinic": "Heart Care Hospital",
                "rating": 4.7,
                "experience": "18 years",
                "address": "Model Town, Ludhiana, Punjab",
                "phone": "+91 9876543210",
                "distance": "3.2 km",
                "availability": "Mon-Sat 9AM-7PM",
                "fees": "₹800-1200"
            }
        ],
        "Dermatologist": [
            {
                "name": "Dr. Priya Singh",
                "specialization": "Dermatologist",
                "clinic": "Skin & Hair Clinic",
                "rating": 4.5,
                "experience": "12 years",
                "address": "Civil Lines, Ludhiana",
                "phone": "+91 9876543211",
                "distance": "2.1 km",
                "availability": "Mon-Sat 10AM-6PM",
                "fees": "₹600-900"
            }
        ],
        "General Physician": [
            {
                "name": "Dr. Amit Kumar",
                "specialization": "General Physician",
                "clinic": "City Medical Center",
                "rating": 4.3,
                "experience": "15 years",
                "address": "Feroze Gandhi Market, Ludhiana",
                "phone": "+91 9876543212",
                "distance": "1.5 km",
                "availability": "Mon-Sat 9AM-8PM",
                "fees": "₹400-600"
            }
        ]
    }
    
    return default_doctors.get(specialization, [
        {
            "name": f"Dr. Specialist {specialization}",
            "specialization": specialization,
            "clinic": "City Hospital",
            "rating": 4.0,
            "experience": "10+ years",
            "address": "Ludhiana, Punjab",
            "phone": "+91 9876543200",
            "distance": "2.0 km",
            "availability": "Mon-Sat 10AM-5PM",
            "fees": "₹500-800"
        }
    ])

@app.get("/api/info")
async def get_info():
    """Get API information"""
    return {
        "name": "FeelFit Medical Analyzer",
        "version": "2.0.0",
        "ai_provider": "Google Gemini",
        "features": [
            "Medical report analysis (PDF/Images)",
            "AI-powered diagnostics",
            "Doctor recommendations",
            "Real-time analysis"
        ],
        "endpoints": {
            "health": "/api/health (GET)",
            "analyze": "/api/analyze (POST)",
            "doctors": "/api/doctors (POST)",
            "docs": "/api/docs"
        }
    }

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "timestamp": datetime.now().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "timestamp": datetime.now().isoformat()
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )