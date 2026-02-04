'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Brain, MapPin, Star, Calendar, Clock, ChevronRight, Moon, Sun, Activity, Heart, AlertCircle, CheckCircle, TrendingUp, User, Phone, Mail, Stethoscope, Pill, TestTube, Download, Share2, Sparkles, Zap, BarChart3, Timer, Globe } from 'lucide-react';

export default function FeelFit() {
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('upload');
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const fileInputRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          setUserLocation({ lat: 30.9010, lng: 75.8573 }); // Ludhiana
        }
      );
    } else {
      setUserLocation({ lat: 30.9010, lng: 75.8573 });
    }

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
  };

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(uploadedFile.type)) {
      alert('Please upload a valid medical report (PDF or Image)');
      return;
    }

    setFile(uploadedFile);
    setActiveTab('analyzing');
    setAnalyzing(true);

    try {
      const base64 = await fileToBase64(uploadedFile);
      const analysis = await analyzeReport(base64, uploadedFile.type);
      
      setAnalysisResult(analysis);
      setAnalyzing(false);
      setActiveTab('results');

      if (analysis.specialization) {
        await findDoctors(analysis.specialization);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalyzing(false);
      alert('Error analyzing report. Please try again.');
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const analyzeReport = async (base64Data, fileType) => {
    const isPDF = fileType === 'application/pdf';
    
    const content = isPDF 
      ? [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64Data }
          },
          {
            type: "text",
            text: `Analyze this medical report comprehensively. Return ONLY valid JSON with no markdown:

{
  "reportType": "type of medical report",
  "patientInfo": {"name": "patient name or 'Not specified'", "age": "age or 'Not specified'", "gender": "gender or 'Not specified'"},
  "testResults": [{"test": "test name", "value": "result value", "normalRange": "normal range", "status": "normal/abnormal/borderline"}],
  "keyFindings": ["finding 1", "finding 2"],
  "diagnosis": "primary diagnosis",
  "severity": "low/moderate/high",
  "recommendations": ["recommendation 1", "recommendation 2"],
  "prescriptions": [{"medication": "name", "dosage": "dosage", "frequency": "frequency", "duration": "duration"}],
  "lifestyle": ["advice 1", "advice 2"],
  "followUp": "follow-up instructions",
  "specialization": "required medical specialization",
  "urgency": "routine/soon/urgent"
}`
          }
        ]
      : [
          {
            type: "image",
            source: { type: "base64", media_type: fileType, data: base64Data }
          },
          {
            type: "text",
            text: `Analyze this medical report image. Return ONLY valid JSON with no markdown:

{
  "reportType": "type of medical report",
  "patientInfo": {"name": "patient name or 'Not specified'", "age": "age or 'Not specified'", "gender": "gender or 'Not specified'"},
  "testResults": [{"test": "test name", "value": "result value", "normalRange": "normal range", "status": "normal/abnormal/borderline"}],
  "keyFindings": ["finding 1", "finding 2"],
  "diagnosis": "primary diagnosis",
  "severity": "low/moderate/high",
  "recommendations": ["recommendation 1", "recommendation 2"],
  "prescriptions": [{"medication": "name", "dosage": "dosage", "frequency": "frequency", "duration": "duration"}],
  "lifestyle": ["advice 1", "advice 2"],
  "followUp": "follow-up instructions",
  "specialization": "required medical specialization",
  "urgency": "routine/soon/urgent"
}`
          }
        ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content }]
      })
    });

    const data = await response.json();
    const textResponse = data.content.filter(item => item.type === "text").map(item => item.text).join("");
    let cleanJson = textResponse.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return JSON.parse(cleanJson);
  };

  const findDoctors = async (specialization) => {
    if (!userLocation) return;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Find top 5 ${specialization} doctors near ${userLocation.lat}, ${userLocation.lng} (Ludhiana area). Return ONLY valid JSON:

{
  "doctors": [
    {
      "name": "Dr. Full Name",
      "specialization": "${specialization}",
      "clinic": "Clinic Name",
      "rating": 4.5,
      "experience": "15 years",
      "address": "Complete address",
      "phone": "Phone number",
      "distance": "2.5 km",
      "availability": "Mon-Sat 10AM-6PM",
      "fees": "₹500-800"
    }
  ]
}`
          }]
        })
      });

      const data = await response.json();
      const textResponse = data.content.filter(item => item.type === "text").map(item => item.text).join("");
      let cleanJson = textResponse.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const result = JSON.parse(cleanJson);
      setDoctors(result.doctors || []);
    } catch (error) {
      console.error('Error finding doctors:', error);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: darkMode ? '#10b981' : '#059669',
      moderate: darkMode ? '#f59e0b' : '#d97706',
      high: darkMode ? '#ef4444' : '#dc2626'
    };
    return colors[severity?.toLowerCase()] || colors.moderate;
  };

  const getStatusColor = (status) => {
    const colors = {
      normal: darkMode ? '#10b981' : '#059669',
      abnormal: darkMode ? '#ef4444' : '#dc2626',
      borderline: darkMode ? '#f59e0b' : '#d97706'
    };
    return colors[status?.toLowerCase()] || colors.normal;
  };

  if (!mounted) return null;

  return (
    <div className={`app-container ${darkMode ? 'dark' : 'light'}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .app-container {
          min-height: 100vh;
          transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        .app-container.dark {
          background: #000000;
          color: #ffffff;
        }

        .app-container.light {
          background: #ffffff;
          color: #000000;
        }

        /* Animated gradient overlay */
        .app-container::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 0;
        }

        .app-container.dark::before {
          background: 
            radial-gradient(circle at 20% 20%, rgba(139, 92, 246, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 40% 60%, rgba(236, 72, 153, 0.02) 0%, transparent 50%);
          animation: gradientShift 20s ease infinite;
        }

        .app-container.light::before {
          background: 
            radial-gradient(circle at 20% 20%, rgba(139, 92, 246, 0.02) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.02) 0%, transparent 50%),
            radial-gradient(circle at 40% 60%, rgba(236, 72, 153, 0.015) 0%, transparent 50%);
          animation: gradientShift 20s ease infinite;
        }

        @keyframes gradientShift {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }

        /* Noise texture */
        .app-container::after {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0.015;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          animation: grain 8s steps(10) infinite;
          pointer-events: none;
          z-index: 1;
        }

        @keyframes grain {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-5%, -10%); }
          20% { transform: translate(-15%, 5%); }
          30% { transform: translate(7%, -25%); }
          40% { transform: translate(-5%, 25%); }
          50% { transform: translate(-15%, 10%); }
          60% { transform: translate(15%, 0%); }
          70% { transform: translate(0%, 15%); }
          80% { transform: translate(3%, 35%); }
          90% { transform: translate(-10%, 10%); }
        }

        /* Enhanced Header */
        .header {
          position: sticky;
          top: 0;
          padding: 1.75rem 3rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid;
          animation: headerSlide 1s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 100;
          backdrop-filter: blur(24px);
        }

        .dark .header {
          border-color: rgba(255, 255, 255, 0.06);
          background: rgba(0, 0, 0, 0.85);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
        }

        .light .header {
          border-color: rgba(0, 0, 0, 0.06);
          background: rgba(255, 255, 255, 0.85);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
        }

        @keyframes headerSlide {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          animation: fadeInLeft 0.8s ease-out 0.2s both;
        }

        @keyframes fadeInLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .logo-icon {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          position: relative;
          overflow: hidden;
        }

        .dark .logo-icon {
          background: linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%);
          box-shadow: 0 8px 32px rgba(255, 255, 255, 0.15);
        }

        .light .logo-icon {
          background: linear-gradient(135deg, #000000 0%, #2a2a2a 100%);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        }

        .logo-icon::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
          animation: shimmer 3s infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
          100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }

        .logo-text h1 {
          font-family: 'Playfair Display', serif;
          font-size: 2.25rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: 0.2rem;
          background: linear-gradient(135deg, currentColor 0%, currentColor 100%);
          -webkit-background-clip: text;
          background-clip: text;
        }

        .logo-text p {
          font-size: 0.8rem;
          opacity: 0.5;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          font-weight: 600;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 2rem;
          animation: fadeInRight 0.8s ease-out 0.3s both;
        }

        @keyframes fadeInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .time-display {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
          padding: 0.75rem 1.25rem;
          border-radius: 12px;
          border: 1px solid;
          min-width: 180px;
        }

        .dark .time-display {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .light .time-display {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.1);
        }

        .current-time {
          font-size: 1.25rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          font-variant-numeric: tabular-nums;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .current-date {
          font-size: 0.75rem;
          opacity: 0.5;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .theme-toggle {
          padding: 0.875rem;
          border-radius: 14px;
          border: 1px solid;
          background: transparent;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dark .theme-toggle {
          border-color: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }

        .light .theme-toggle {
          border-color: rgba(0, 0, 0, 0.1);
          color: #000000;
        }

        .theme-toggle:hover {
          transform: rotate(180deg) scale(1.1);
        }

        .dark .theme-toggle:hover {
          border-color: rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 8px 32px rgba(255, 255, 255, 0.1);
        }

        .light .theme-toggle:hover {
          border-color: rgba(0, 0, 0, 0.3);
          background: rgba(0, 0, 0, 0.05);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .main-content {
          position: relative;
          max-width: 1400px;
          margin: 0 auto;
          padding: 5rem 3rem;
          z-index: 10;
        }

        /* Upload Section with enhanced animations */
        .upload-section {
          animation: fadeInUp 1s ease-out 0.4s both;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .upload-header {
          text-align: center;
          margin-bottom: 4rem;
        }

        .upload-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1.25rem;
          border-radius: 100px;
          font-size: 0.85rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 2rem;
          animation: pulse 2s ease-in-out infinite;
        }

        .dark .upload-badge {
          background: rgba(139, 92, 246, 0.1);
          color: #a78bfa;
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        .light .upload-badge {
          background: rgba(139, 92, 246, 0.08);
          color: #7c3aed;
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.03); opacity: 0.9; }
        }

        .upload-title {
          font-family: 'Playfair Display', serif;
          font-size: 5rem;
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 1.5rem;
          letter-spacing: -0.04em;
          background: linear-gradient(135deg, currentColor 0%, currentColor 100%);
          -webkit-background-clip: text;
          background-clip: text;
        }

        .upload-subtitle {
          font-size: 1.35rem;
          opacity: 0.6;
          margin: 0 auto;
          max-width: 700px;
          line-height: 1.7;
          font-weight: 400;
        }

        .upload-zone {
          border: 2px dashed;
          border-radius: 32px;
          padding: 5rem 3rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .dark .upload-zone {
          border-color: rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.02);
        }

        .light .upload-zone {
          border-color: rgba(0, 0, 0, 0.12);
          background: rgba(0, 0, 0, 0.02);
        }

        .upload-zone::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.05), transparent);
          transition: left 0.7s ease;
        }

        .upload-zone:hover::before {
          left: 100%;
        }

        .upload-zone:hover {
          transform: translateY(-8px) scale(1.01);
        }

        .dark .upload-zone:hover {
          border-color: rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 24px 80px rgba(139, 92, 246, 0.15);
        }

        .light .upload-zone:hover {
          border-color: rgba(0, 0, 0, 0.3);
          background: rgba(0, 0, 0, 0.04);
          box-shadow: 0 24px 80px rgba(139, 92, 246, 0.12);
        }

        .upload-icon-wrapper {
          width: 120px;
          height: 120px;
          margin: 0 auto 2.5rem;
          position: relative;
        }

        .upload-icon {
          width: 100%;
          height: 100%;
          opacity: 0.7;
          animation: floatUpDown 4s ease-in-out infinite;
        }

        @keyframes floatUpDown {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-10px) rotate(-3deg); }
          75% { transform: translateY(-10px) rotate(3deg); }
        }

        .upload-icon-wrapper::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 140%;
          height: 140%;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          animation: ripple 3s ease-out infinite;
        }

        .dark .upload-icon-wrapper::before {
          background: radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%);
        }

        .light .upload-icon-wrapper::before {
          background: radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%);
        }

        @keyframes ripple {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }

        .upload-text h3 {
          font-family: 'Playfair Display', serif;
          font-size: 2.25rem;
          font-weight: 700;
          margin-bottom: 1rem;
          letter-spacing: -0.02em;
        }

        .upload-text p {
          opacity: 0.5;
          font-size: 1.1rem;
          font-weight: 500;
        }

        .file-types {
          margin-top: 3rem;
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .file-type-badge {
          padding: 0.65rem 1.25rem;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          transition: all 0.3s ease;
        }

        .dark .file-type-badge {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.8);
        }

        .light .file-type-badge {
          background: rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.12);
          color: rgba(0, 0, 0, 0.8);
        }

        .file-type-badge:hover {
          transform: translateY(-2px);
        }

        .dark .file-type-badge:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .light .file-type-badge:hover {
          background: rgba(0, 0, 0, 0.06);
          border-color: rgba(0, 0, 0, 0.2);
        }

        /* Analyzing Section */
        .analyzing-section {
          text-align: center;
          padding: 8rem 2rem;
          animation: fadeIn 0.6s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .analyzing-spinner-wrapper {
          position: relative;
          width: 160px;
          height: 160px;
          margin: 0 auto 4rem;
        }

        .analyzing-spinner {
          width: 100%;
          height: 100%;
          border: 4px solid;
          border-radius: 50%;
          border-top-color: transparent;
          animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        }

        .dark .analyzing-spinner {
          border-color: rgba(255, 255, 255, 0.15);
          border-top-color: #ffffff;
          box-shadow: 0 0 60px rgba(139, 92, 246, 0.3);
        }

        .light .analyzing-spinner {
          border-color: rgba(0, 0, 0, 0.15);
          border-top-color: #000000;
          box-shadow: 0 0 60px rgba(139, 92, 246, 0.2);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .analyzing-spinner-wrapper::before,
        .analyzing-spinner-wrapper::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100%;
          height: 100%;
          border: 3px solid transparent;
          border-radius: 50%;
          transform: translate(-50%, -50%);
        }

        .analyzing-spinner-wrapper::before {
          width: 120%;
          height: 120%;
          animation: spin 2s linear infinite reverse;
        }

        .dark .analyzing-spinner-wrapper::before {
          border-top-color: rgba(139, 92, 246, 0.3);
        }

        .light .analyzing-spinner-wrapper::before {
          border-top-color: rgba(139, 92, 246, 0.25);
        }

        .analyzing-title {
          font-family: 'Playfair Display', serif;
          font-size: 3.5rem;
          font-weight: 700;
          margin-bottom: 1.25rem;
          letter-spacing: -0.03em;
        }

        .analyzing-text {
          font-size: 1.2rem;
          opacity: 0.5;
          font-weight: 500;
        }

        /* Results Section */
        .results-section {
          animation: fadeInUp 0.8s ease-out;
        }

        .results-header {
          margin-bottom: 3.5rem;
          padding-bottom: 2.5rem;
          border-bottom: 1px solid;
          animation: fadeInUp 0.6s ease-out 0.2s both;
        }

        .dark .results-header {
          border-color: rgba(255, 255, 255, 0.08);
        }

        .light .results-header {
          border-color: rgba(0, 0, 0, 0.08);
        }

        .results-title {
          font-family: 'Playfair Display', serif;
          font-size: 4rem;
          font-weight: 800;
          margin-bottom: 1.5rem;
          letter-spacing: -0.03em;
        }

        .results-meta {
          display: flex;
          gap: 2.5rem;
          flex-wrap: wrap;
          opacity: 0.6;
          font-size: 1rem;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          font-weight: 500;
        }

        /* Cards Grid */
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
          gap: 2.5rem;
          margin-bottom: 3.5rem;
        }

        .card {
          padding: 3rem;
          border-radius: 28px;
          border: 1px solid;
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .dark .card {
          background: rgba(255, 255, 255, 0.02);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .light .card {
          background: rgba(255, 255, 255, 0.7);
          border-color: rgba(0, 0, 0, 0.08);
        }

        .card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.5), transparent);
          opacity: 0;
          transition: opacity 0.4s ease;
        }

        .card:hover::before {
          opacity: 1;
        }

        .card:hover {
          transform: translateY(-6px);
        }

        .dark .card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 24px 80px rgba(139, 92, 246, 0.15);
        }

        .light .card:hover {
          background: rgba(255, 255, 255, 0.95);
          border-color: rgba(0, 0, 0, 0.15);
          box-shadow: 0 24px 80px rgba(139, 92, 246, 0.12);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          margin-bottom: 2rem;
        }

        .card-icon {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          transition: transform 0.3s ease;
        }

        .card:hover .card-icon {
          transform: scale(1.1) rotate(-5deg);
        }

        .dark .card-icon {
          background: rgba(255, 255, 255, 0.08);
        }

        .light .card-icon {
          background: rgba(0, 0, 0, 0.06);
        }

        .card-title {
          font-family: 'Playfair Display', serif;
          font-size: 2rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .test-result {
          padding: 1.5rem;
          border-radius: 16px;
          margin-bottom: 1.25rem;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid transparent;
        }

        .dark .test-result {
          background: rgba(255, 255, 255, 0.03);
        }

        .light .test-result {
          background: rgba(0, 0, 0, 0.03);
        }

        .test-result:hover {
          transform: translateX(8px);
        }

        .dark .test-result:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .light .test-result:hover {
          background: rgba(0, 0, 0, 0.05);
          border-color: rgba(0, 0, 0, 0.1);
        }

        .test-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .test-name {
          font-weight: 700;
          font-size: 1.1rem;
        }

        .test-status {
          padding: 0.4rem 0.9rem;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .test-details {
          display: flex;
          justify-content: space-between;
          opacity: 0.6;
          font-size: 0.95rem;
          font-weight: 500;
        }

        .recommendation-item,
        .finding-item,
        .lifestyle-item {
          padding: 1.25rem 1.5rem;
          border-left: 4px solid;
          margin-bottom: 1rem;
          border-radius: 0 12px 12px 0;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .dark .recommendation-item,
        .dark .finding-item,
        .dark .lifestyle-item {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .light .recommendation-item,
        .light .finding-item,
        .light .lifestyle-item {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.2);
        }

        .recommendation-item:hover,
        .finding-item:hover,
        .lifestyle-item:hover {
          transform: translateX(8px);
          border-width: 5px;
        }

        .dark .recommendation-item:hover,
        .dark .finding-item:hover,
        .dark .lifestyle-item:hover {
          border-color: rgba(139, 92, 246, 0.8);
          background: rgba(139, 92, 246, 0.08);
        }

        .light .recommendation-item:hover,
        .light .finding-item:hover,
        .light .lifestyle-item:hover {
          border-color: rgba(139, 92, 246, 0.6);
          background: rgba(139, 92, 246, 0.06);
        }

        .prescription-card {
          padding: 2rem;
          border-radius: 16px;
          margin-bottom: 1.25rem;
          border: 1px solid;
          transition: all 0.3s ease;
        }

        .dark .prescription-card {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .light .prescription-card {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.1);
        }

        .prescription-card:hover {
          transform: translateY(-3px);
        }

        .dark .prescription-card:hover {
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
        }

        .light .prescription-card:hover {
          border-color: rgba(0, 0, 0, 0.2);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
        }

        .prescription-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .pill-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
        }

        .dark .pill-icon {
          background: rgba(255, 255, 255, 0.1);
        }

        .light .pill-icon {
          background: rgba(0, 0, 0, 0.08);
        }

        .medication-name {
          font-weight: 800;
          font-size: 1.2rem;
        }

        .prescription-details {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
        }

        .prescription-detail {
          padding: 1rem;
          border-radius: 10px;
          transition: all 0.3s ease;
        }

        .dark .prescription-detail {
          background: rgba(255, 255, 255, 0.05);
        }

        .light .prescription-detail {
          background: rgba(0, 0, 0, 0.05);
        }

        .prescription-detail:hover {
          transform: scale(1.05);
        }

        .detail-label {
          font-size: 0.75rem;
          opacity: 0.5;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 0.4rem;
          font-weight: 600;
        }

        .detail-value {
          font-weight: 700;
          font-size: 1rem;
        }

        /* Doctors Section */
        .doctors-section {
          margin-top: 5rem;
          animation: fadeInUp 0.8s ease-out 0.4s both;
        }

        .section-title {
          font-family: 'Playfair Display', serif;
          font-size: 3rem;
          font-weight: 800;
          margin-bottom: 2.5rem;
          display: flex;
          align-items: center;
          gap: 1.25rem;
          letter-spacing: -0.03em;
        }

        .doctors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
          gap: 2.5rem;
        }

        .doctor-card {
          padding: 2.5rem;
          border-radius: 28px;
          border: 1px solid;
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }

        .dark .doctor-card {
          background: rgba(255, 255, 255, 0.02);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .light .doctor-card {
          background: rgba(255, 255, 255, 0.7);
          border-color: rgba(0, 0, 0, 0.08);
        }

        .doctor-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.05), transparent);
          transition: left 0.6s ease;
        }

        .doctor-card:hover::before {
          left: 100%;
        }

        .doctor-card:hover {
          transform: translateY(-8px) scale(1.01);
        }

        .dark .doctor-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 28px 90px rgba(139, 92, 246, 0.2);
        }

        .light .doctor-card:hover {
          background: rgba(255, 255, 255, 0.98);
          border-color: rgba(0, 0, 0, 0.2);
          box-shadow: 0 28px 90px rgba(139, 92, 246, 0.15);
        }

        .doctor-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 2rem;
        }

        .doctor-info h3 {
          font-family: 'Playfair Display', serif;
          font-size: 1.8rem;
          font-weight: 800;
          margin-bottom: 0.65rem;
          letter-spacing: -0.02em;
        }

        .doctor-specialization {
          opacity: 0.6;
          font-size: 1rem;
          margin-bottom: 0.6rem;
          font-weight: 600;
        }

        .doctor-rating {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.65rem 1.25rem;
          border-radius: 12px;
          font-weight: 800;
          font-size: 1.1rem;
        }

        .dark .doctor-rating {
          background: rgba(255, 215, 0, 0.15);
          color: #ffd700;
        }

        .light .doctor-rating {
          background: rgba(255, 215, 0, 0.2);
          color: #d4af37;
        }

        .doctor-details {
          display: grid;
          gap: 1.25rem;
        }

        .detail-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border-radius: 12px;
          transition: all 0.3s ease;
          font-weight: 500;
        }

        .dark .detail-row {
          background: rgba(255, 255, 255, 0.03);
        }

        .light .detail-row {
          background: rgba(0, 0, 0, 0.03);
        }

        .detail-row:hover {
          transform: translateX(6px);
        }

        .dark .detail-row:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .light .detail-row:hover {
          background: rgba(0, 0, 0, 0.06);
        }

        .detail-icon {
          opacity: 0.5;
          width: 22px;
          height: 22px;
          flex-shrink: 0;
        }

        .contact-buttons {
          display: flex;
          gap: 1.25rem;
          margin-top: 2rem;
        }

        .btn {
          flex: 1;
          padding: 1.1rem 1.75rem;
          border-radius: 14px;
          border: 1px solid;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          font-size: 0.95rem;
        }

        .btn-primary {
          color: white;
        }

        .dark .btn-primary {
          background: #ffffff;
          color: #000000;
          border-color: #ffffff;
        }

        .light .btn-primary {
          background: #000000;
          color: #ffffff;
          border-color: #000000;
        }

        .btn-primary:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
        }

        .btn-secondary {
          background: transparent;
        }

        .dark .btn-secondary {
          border-color: rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }

        .light .btn-secondary {
          border-color: rgba(0, 0, 0, 0.2);
          color: #000000;
        }

        .dark .btn-secondary:hover {
          border-color: rgba(255, 255, 255, 0.5);
          background: rgba(255, 255, 255, 0.05);
        }

        .light .btn-secondary:hover {
          border-color: rgba(0, 0, 0, 0.5);
          background: rgba(0, 0, 0, 0.05);
        }

        .action-bar {
          position: fixed;
          bottom: 2.5rem;
          right: 2.5rem;
          display: flex;
          gap: 1rem;
          z-index: 100;
          animation: slideInRight 0.6s ease-out 1s both;
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .action-btn {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 1px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .dark .action-btn {
          background: rgba(0, 0, 0, 0.9);
          border-color: rgba(255, 255, 255, 0.2);
          color: #ffffff;
          backdrop-filter: blur(16px);
        }

        .light .action-btn {
          background: rgba(255, 255, 255, 0.9);
          border-color: rgba(0, 0, 0, 0.2);
          color: #000000;
          backdrop-filter: blur(16px);
        }

        .action-btn:hover {
          transform: scale(1.15) rotate(10deg);
        }

        .dark .action-btn:hover {
          background: #ffffff;
          color: #000000;
          box-shadow: 0 12px 50px rgba(139, 92, 246, 0.3);
        }

        .light .action-btn:hover {
          background: #000000;
          color: #ffffff;
          box-shadow: 0 12px 50px rgba(139, 92, 246, 0.25);
        }

        .severity-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.9rem 1.5rem;
          border-radius: 14px;
          font-weight: 800;
          font-size: 1.05rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        @media (max-width: 768px) {
          .header {
            padding: 1.5rem 1.5rem;
            flex-direction: column;
            gap: 1.5rem;
          }

          .header-right {
            width: 100%;
            justify-content: space-between;
          }

          .time-display {
            min-width: auto;
          }

          .main-content {
            padding: 3rem 1.5rem;
          }

          .upload-title {
            font-size: 3rem;
          }

          .cards-grid,
          .doctors-grid {
            grid-template-columns: 1fr;
          }

          .prescription-details {
            grid-template-columns: 1fr;
          }

          .action-bar {
            bottom: 1.5rem;
            right: 1.5rem;
            flex-direction: column;
          }

          .action-btn {
            width: 56px;
            height: 56px;
          }
        }
      `}</style>

      {/* Enhanced Header */}
      <header className="header">
        <div className="logo-section">
          <div className="logo-icon">
            <Activity size={32} color={darkMode ? '#000000' : '#ffffff'} strokeWidth={2.5} />
          </div>
          <div className="logo-text">
            <h1>FeelFit</h1>
            <p>Medical Intelligence</p>
          </div>
        </div>
        
        <div className="header-right">
          <div className="time-display">
            <div className="current-time">
              <Timer size={18} />
              {formatTime(currentTime)}
            </div>
            <div className="current-date">
              <Globe size={14} />
              {formatDate(currentTime)} • IST
            </div>
          </div>
          
          <button className="theme-toggle" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? <Sun size={26} /> : <Moon size={26} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === 'upload' && (
          <section className="upload-section">
            <div className="upload-header">
              <div className="upload-badge">
                <Sparkles size={16} />
                AI-Powered Analysis
              </div>
              <h1 className="upload-title">
                Advanced Medical<br />Report Intelligence
              </h1>
              <p className="upload-subtitle">
                Experience the future of healthcare with AI-driven medical report analysis, 
                comprehensive diagnostics, and personalized specialist recommendations.
              </p>
            </div>

            <div 
              className="upload-zone"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="upload-icon-wrapper">
                <Upload className="upload-icon" size={90} strokeWidth={1.5} />
              </div>
              <div className="upload-text">
                <h3>Upload Your Medical Report</h3>
                <p>Drag and drop or click to browse files</p>
              </div>
              <div className="file-types">
                <span className="file-type-badge">PDF Reports</span>
                <span className="file-type-badge">JPEG Images</span>
                <span className="file-type-badge">PNG Scans</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>
          </section>
        )}

        {activeTab === 'analyzing' && analyzing && (
          <div className="analyzing-section">
            <div className="analyzing-spinner-wrapper">
              <div className="analyzing-spinner"></div>
            </div>
            <h2 className="analyzing-title">Analyzing Your Report</h2>
            <p className="analyzing-text">
              Our advanced AI is processing your medical data with state-of-the-art NLP and computer vision...
            </p>
          </div>
        )}

        {activeTab === 'results' && analysisResult && (
          <section className="results-section">
            <div className="results-header">
              <h1 className="results-title">Analysis Complete</h1>
              <div className="results-meta">
                <div className="meta-item">
                  <FileText size={20} />
                  <span>{analysisResult.reportType}</span>
                </div>
                <div className="meta-item">
                  <User size={20} />
                  <span>{analysisResult.patientInfo?.name || 'Patient'}</span>
                </div>
                <div className="meta-item">
                  <Calendar size={20} />
                  <span>{formatDate(currentTime)}</span>
                </div>
                <div className="meta-item">
                  <Zap size={20} />
                  <span>AI Processed</span>
                </div>
              </div>
            </div>

            {/* Key Findings & Diagnosis */}
            <div className="cards-grid">
              <div className="card">
                <div className="card-header">
                  <div className="card-icon">
                    <Brain size={28} />
                  </div>
                  <h2 className="card-title">Diagnosis</h2>
                </div>
                <div style={{ marginBottom: '2rem' }}>
                  <div className="severity-badge" style={{ 
                    background: `${getSeverityColor(analysisResult.severity)}20`,
                    color: getSeverityColor(analysisResult.severity)
                  }}>
                    <AlertCircle size={20} />
                    {analysisResult.severity} Severity
                  </div>
                </div>
                <p style={{ fontSize: '1.15rem', lineHeight: '1.8', marginBottom: '2rem', fontWeight: 500 }}>
                  {analysisResult.diagnosis}
                </p>
                <div>
                  <h4 style={{ marginBottom: '1.25rem', opacity: 0.6, fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Key Findings</h4>
                  {analysisResult.keyFindings?.map((finding, idx) => (
                    <div key={idx} className="finding-item">
                      {finding}
                    </div>
                  ))}
                </div>
              </div>

              {/* Test Results */}
              {analysisResult.testResults && analysisResult.testResults.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-icon">
                      <TestTube size={28} />
                    </div>
                    <h2 className="card-title">Test Results</h2>
                  </div>
                  {analysisResult.testResults.map((test, idx) => (
                    <div key={idx} className="test-result">
                      <div className="test-header">
                        <span className="test-name">{test.test}</span>
                        <span 
                          className="test-status"
                          style={{ 
                            background: `${getStatusColor(test.status)}25`,
                            color: getStatusColor(test.status)
                          }}
                        >
                          {test.status}
                        </span>
                      </div>
                      <div className="test-details">
                        <span><strong>Result:</strong> {test.value}</span>
                        <span><strong>Normal:</strong> {test.normalRange}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prescriptions */}
            {analysisResult.prescriptions && analysisResult.prescriptions.length > 0 && (
              <div className="card" style={{ marginBottom: '2.5rem' }}>
                <div className="card-header">
                  <div className="card-icon">
                    <Pill size={28} />
                  </div>
                  <h2 className="card-title">Prescribed Medications</h2>
                </div>
                {analysisResult.prescriptions.map((rx, idx) => (
                  <div key={idx} className="prescription-card">
                    <div className="prescription-header">
                      <div className="pill-icon">
                        <Pill size={22} />
                      </div>
                      <div className="medication-name">{rx.medication}</div>
                    </div>
                    <div className="prescription-details">
                      <div className="prescription-detail">
                        <div className="detail-label">Dosage</div>
                        <div className="detail-value">{rx.dosage}</div>
                      </div>
                      <div className="prescription-detail">
                        <div className="detail-label">Frequency</div>
                        <div className="detail-value">{rx.frequency}</div>
                      </div>
                      <div className="prescription-detail">
                        <div className="detail-label">Duration</div>
                        <div className="detail-value">{rx.duration}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations & Lifestyle */}
            <div className="cards-grid">
              <div className="card">
                <div className="card-header">
                  <div className="card-icon">
                    <CheckCircle size={28} />
                  </div>
                  <h2 className="card-title">Recommendations</h2>
                </div>
                {analysisResult.recommendations?.map((rec, idx) => (
                  <div key={idx} className="recommendation-item">
                    {rec}
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-icon">
                    <Heart size={28} />
                  </div>
                  <h2 className="card-title">Lifestyle Advice</h2>
                </div>
                {analysisResult.lifestyle?.map((advice, idx) => (
                  <div key={idx} className="lifestyle-item">
                    {advice}
                  </div>
                ))}
              </div>
            </div>

            {/* Follow-up */}
            {analysisResult.followUp && (
              <div className="card" style={{ marginBottom: '4rem' }}>
                <div className="card-header">
                  <div className="card-icon">
                    <Clock size={28} />
                  </div>
                  <h2 className="card-title">Follow-up Care</h2>
                </div>
                <div style={{ 
                  padding: '2rem', 
                  borderRadius: '16px',
                  background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  fontSize: '1.1rem',
                  lineHeight: '1.8',
                  fontWeight: 500
                }}>
                  {analysisResult.followUp}
                </div>
              </div>
            )}

            {/* Recommended Doctors */}
            {doctors.length > 0 && (
              <div className="doctors-section">
                <h2 className="section-title">
                  <Stethoscope size={36} />
                  Recommended Specialists
                </h2>
                <div className="doctors-grid">
                  {doctors.map((doctor, idx) => (
                    <div key={idx} className="doctor-card">
                      <div className="doctor-header">
                        <div className="doctor-info">
                          <h3>{doctor.name}</h3>
                          <p className="doctor-specialization">{doctor.specialization}</p>
                          <p style={{ opacity: 0.5, fontSize: '0.9rem', fontWeight: 600 }}>{doctor.experience}</p>
                        </div>
                        <div className="doctor-rating">
                          <Star size={20} fill="currentColor" />
                          {doctor.rating}
                        </div>
                      </div>
                      
                      <div className="doctor-details">
                        <div className="detail-row">
                          <MapPin className="detail-icon" size={22} />
                          <span>{doctor.clinic}</span>
                        </div>
                        <div className="detail-row">
                          <MapPin className="detail-icon" size={22} />
                          <span>{doctor.address}</span>
                        </div>
                        <div className="detail-row">
                          <Clock className="detail-icon" size={22} />
                          <span>{doctor.availability}</span>
                        </div>
                        <div className="detail-row">
                          <TrendingUp className="detail-icon" size={22} />
                          <span>{doctor.distance} away</span>
                        </div>
                        <div className="detail-row">
                          <span style={{ fontWeight: 700 }}>Consultation: {doctor.fees}</span>
                        </div>
                      </div>

                      <div className="contact-buttons">
                        <button className="btn btn-primary">
                          <Phone size={20} />
                          Book Appointment
                        </button>
                        <button className="btn btn-secondary">
                          <MapPin size={20} />
                          Directions
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Floating Action Buttons */}
      {analysisResult && (
        <div className="action-bar">
          <button 
            className="action-btn"
            onClick={() => {
              setFile(null);
              setAnalysisResult(null);
              setDoctors([]);
              setActiveTab('upload');
            }}
            title="New Analysis"
          >
            <Upload size={26} />
          </button>
          <button className="action-btn" title="Download Report">
            <Download size={26} />
          </button>
          <button className="action-btn" title="Share Report">
            <Share2 size={26} />
          </button>
        </div>
      )}
    </div>
  );
}
