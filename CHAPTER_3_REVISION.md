# Chapter 3 Revision: System Architecture & Software Environment
> **Manuscript Replacement for Chapter 3 (Page 72)**  
> **Project:** AralSync: An AI-Powered Academic Recovery & Accessible Learning Platform  
> **Document Purpose:** Copy-and-paste replacement text and defense defense guide for the thesis panel revision.

---

## 1. Replacement Text for Chapter 3 (Page 72: Software Specification & Architecture)

*Copy and paste the following academic section directly into your thesis manuscript on Page 72 to replace the outdated Express.js description:*

```text
3.X Software Architecture and Implementation Environment

The AralSync platform is developed using a unified, modern full-stack web architecture anchored on Next.js 16 (App Router) with React 19, TypeScript, and native Node.js Route Handlers, complemented by a specialized Python artificial intelligence microservice.

Contrary to traditional decoupled web architectures that necessitate maintaining two distinct server instances—typically a client-side Single Page Application (SPA) and an independent Express.js server—the current implementation leverages Next.js 16's unified App Router paradigm. In this architecture:

1. Client Presentation Tier (React 19 & Tailwind CSS):
   Interactive user interfaces across the four institutional roles (Teacher, Student, Principal, and Curriculum Coordinator) are constructed using React 19 functional components. The presentation tier features responsive DepEd examination paper layouts, interactive optical mark recognition (OMR) assessment previews, audio recording widgets for oral reading fluency, and real-time analytical dashboards rendered with Tailwind CSS and Recharts.

2. Application and Server Tier (Next.js Route Handlers):
   Backend business logic, secure session management, and RESTful API endpoints (/api/*) are executed natively within the Node.js runtime using Next.js Route Handlers. Route Handlers eliminate the operational overhead, cross-origin resource sharing (CORS) security vulnerabilities, and network latency inherent in standalone Express.js servers. State-of-the-art authentication is enforced via cryptographically signed JSON Web Tokens (JWT) stored exclusively in secure, HttpOnly, SameSite cookies with strict role-based access control (RBAC).

3. AI and Computer Vision Microservice (Python FastAPI):
   To prevent compute-intensive computer vision and digital signal processing from blocking the Node.js event loop, specialized algorithms are isolated in a lightweight Python 3.10+ FastAPI microservice operating on port 8000:
   - PyMuPDF (Fitz): High-resolution 144 DPI rendering of official DepEd ARAL workbook PDF pages for verbatim exercise extraction.
   - OpenCV (cv2): Four-point fiducial marker alignment, perspective transformation, adaptive thresholding, and disk-mask pixel-density scoring for 50-item DepEd bubble sheets.
   - Librosa and NumPy: Acoustic feature extraction, including Words Per Minute (WPM), pause-frequency ratio, and articulation pacing for Philippine Informal Reading Inventory (Phil-IRI) oral reading evaluations.
   - Scikit-Learn: K-Means unsupervised clustering for longitudinal learner risk tiering and mastery grouping.

4. Cloud AI Integration:
   The application integrates low-latency external foundation models:
   - Groq Cloud API (Whisper Large v3): Sub-second automated speech-to-text transcription paired with Levenshtein Word Error Rate (WER) alignment for Phil-IRI miscue categorization.
   - OpenAI Vision API (gpt-4o-mini): Verbatim optical character recognition of workbook activities, paired with a deterministic local DepEd curriculum fallback engine to guarantee offline and zero-credit availability.

5. Data Persistence Tier (MongoDB & Mongoose):
   All persistent data is managed through MongoDB using Mongoose Object Data Modeling (ODM), structuring relational documents across collections including Users, Assessments, LearnerRecords, QuestionBank, AnswerKeys, Interventions, LearningMaterials, ReadingPassages, and AuditLogs.
```

---

## 2. Table for Chapter 3: Software Environment Specifications

*Insert this formal specification table into Chapter 3 (Page 72 or 73):*

| Component / Layer | Technology | Version | Architectural Role |
| :--- | :--- | :--- | :--- |
| **Full-Stack Framework** | **Next.js (App Router)** | `16.2.x` | Unified frontend page rendering, static document generation, and backend API routing. |
| **Frontend Library** | **React** | `19.2.x` | Declarative component UI, hooks, and client-side state management. |
| **Programming Language** | **TypeScript** | `5.x` | Static typing ensuring end-to-end data contract integrity between database models and UI props. |
| **Backend API Engine** | **Next.js Route Handlers** | `16.2.x` | Server-side RESTful endpoints (replaces standalone Express.js server). |
| **Styling Framework** | **Tailwind CSS** | `4.x` | Utility-first responsive CSS styling with custom DepEd examination design system tokens. |
| **AI Microservice** | **Python (FastAPI / Uvicorn)** | `3.10+` | High-performance asynchronous microservice for computer vision, audio DSP, and ML clustering. |
| **Computer Vision Engine** | **OpenCV (`cv2`)** | `4.x` | OMR fiducial marker detection, perspective transformation, and bubble darkness scoring. |
| **Document Processing** | **PyMuPDF (`fitz`)** | `1.24+` | PDF vector parsing and 144 DPI high-resolution page rendering. |
| **Speech & Audio Processing** | **Librosa & NumPy** | Latest | Acoustic speech analysis: speech rate, pause ratios, and articulation duration. |
| **Database Management** | **MongoDB / Mongoose ODM** | `7.x / 9.9.x` | Document-oriented database for learner records, item banks, and assessment answer keys. |
| **Speech-to-Text Engine** | **Groq Whisper Large v3** | Cloud API | Fast automated speech transcription for Phil-IRI oral reading assessments. |
| **Vision OCR Engine** | **OpenAI (`gpt-4o-mini`)** | Cloud API | Verbatim exercise extraction with local DepEd curriculum fallback. |

---

## 3. Defense Guide: How to Answer the Panelist

When the panelist asks:
> *"Page 72 says you use Express.js, but your code is built on Next.js 16 (App Router) with React 19, TypeScript, and Route Handlers. Why do you have this many instead of one?"*

### Response Script:
> **1. Clarify that it is ONE unified framework:**
> *"Thank you for pointing that out, esteemed panelist. We would like to clarify that Next.js 16, React 19, TypeScript, and Route Handlers are not multiple competing systems—they are actually **one single full-stack framework**.*
> 
> *In traditional web development, developers had to build two completely separate systems: a React frontend server and an Express.js backend server. However, Next.js combines both under one unified repository: **React 19** handles the user interface, while **Route Handlers** act as our native backend server, which completely eliminates the need for Express.js.*
> 
> **2. Explain why the manuscript had Express.js:**
> *"The reference to Express.js on Page 72 was from our initial architectural proposal when we initially considered a decoupled MERN stack. During implementation, we modernized the system to Next.js App Router.*
> 
> **3. Explain the 3 engineering benefits:**
> *- **Single Server**: Instead of maintaining two ports and servers, `next start` serves both the UI and the REST APIs seamlessly.*
> *- **Zero CORS Overhead**: Because the frontend and backend share the exact same domain origin, cross-origin security vulnerabilities and pre-flight latencies are completely avoided.*
> *- **End-to-End Type Safety**: TypeScript types are shared between our MongoDB Mongoose schemas and our frontend components, preventing data mismatches.*
> 
> *We have documented this architectural refinement and updated Page 72 accordingly in our revised manuscript."*
