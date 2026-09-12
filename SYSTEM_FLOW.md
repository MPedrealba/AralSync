# AralSync — System Flow Diagram

> Open this file in VS Code and press **Ctrl+Shift+V** to see rendered diagrams.
> If diagrams appear blank, ensure the **Markdown Preview Mermaid Support** extension is installed.

---

## 1. High-Level Architecture

```mermaid
flowchart TB
    subgraph Client["Client - Next.js React"]
        Login["/login"]
        T_Dash["Teacher Dashboard\n/dashboard/*"]
        S_Dash["Student Portal\n/student/*"]
        P_Dash["Principal Dashboard\n/principal/*"]
    end

    subgraph Auth["Auth Layer"]
        JWT["JWT in HttpOnly Cookie"]
        AuthAPI["POST /api/auth/login\nGET /api/auth/me\nPOST /api/auth/logout"]
    end

    subgraph API["Next.js API Routes - Node.js"]
        T_API["Teacher APIs\nassessments, learners,\nOMR, reading, interventions"]
        S_API["Student APIs\nassessments, interventions,\nreading"]
        P_API["Principal APIs\ndashboard, reports,\nanalytics, audit-log"]
    end

    subgraph AI["Python AI Microservice :8000"]
        OMR_CV["OpenCV OMR Scanner\nPOST /omr/detect"]
        Reading_Feat["Librosa Reading Features\nPOST /reading/analyze"]
        KMeans["K-Means Clustering\nPOST /cluster/analyze"]
    end

    subgraph External["External APIs"]
        Groq["Groq Whisper API\nSpeech-to-Text"]
    end

    subgraph DB[("MongoDB")]
        Users["Users"]
        Assessments["Assessments"]
        LearnerRec["LearnerRecords"]
        Questions["Questions Bank"]
        AnswerKeys["AnswerKeys"]
        Interventions["Interventions"]
        ReadingPass["ReadingPassages"]
        CustomExams["CustomExams"]
        AuditLog["AuditLogs"]
    end

    Login --> AuthAPI --> JWT
    JWT --> T_Dash
    JWT --> S_Dash
    JWT --> P_Dash
    T_Dash --> T_API
    S_Dash --> S_API
    P_Dash --> P_API
    T_API --> DB
    S_API --> DB
    P_API --> DB
    T_API --> OMR_CV
    T_API --> Reading_Feat
    T_API --> KMeans
    S_API --> Reading_Feat
    T_API --> Groq
    S_API --> Groq
```

---

## 2. Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant Page as Login Page
    participant API as /api/auth/login
    participant DB as MongoDB
    participant Cookie as HttpOnly Cookie

    User->>Page: Enter username + password
    Page->>API: POST { username, password }
    API->>DB: Find User by username
    DB-->>API: User document
    API->>API: bcrypt.compare(password, hash)
    alt Match
        API->>API: Sign JWT { id, role, name }
        API->>Cookie: Set-Cookie: token=jwt; HttpOnly
        API-->>Page: { user: { id, name, role } }
        Page->>Page: Redirect based on role
    else No match
        API-->>Page: 401 Invalid credentials
    end

    Note over Page,Cookie: All subsequent requests carry JWT cookie
    Page->>API: GET /api/auth/me (with cookie)
    API->>API: Verify JWT and return user profile
```

**Role-based routing:**

| Role | Redirect |
|------|----------|
| `teacher` | `/dashboard` |
| `student` | `/student` |
| `principal` | `/principal` |

---

## 3. Teacher Workflow

```mermaid
flowchart LR
    subgraph Assessments["Assessments"]
        Gen["Generate 50-item Exam\nPOST /questionnaire/generate"]
        Upload["Upload Custom Exam\nPOST /exams"]
        Print["Print Questionnaire\n+ Bubble Sheet"]
        Scan["OMR Scan\nPOST /omr"]
        Grade["Grade Written Items\nPATCH /assessments/:id/written"]
    end

    subgraph Reading["Reading Fluency"]
        Record["Record Audio\nMediaRecorder"]
        Whisper["Transcribe\nGroq Whisper"]
        Analyze["Analyze\nPOST /reading/analyze"]
        PhilIRI["Phil-IRI Scoring\nIndependent / Instructional /\nFrustration / Non-Reader"]
    end

    subgraph Analytics["Analytics"]
        SkillGap["Skill Gap Analysis"]
        Recovery["Learning Recovery"]
        Progress["Progress Monitoring"]
        Comp["Comprehension Check"]
    end

    subgraph Learners["Learners"]
        List["View Learners"]
        Import["Import from Excel\n.xlsx bulk upload"]
        Edit["Edit Learner"]
    end

    subgraph Actions["Actions"]
        Recommend["Assign Recommendations"]
        Intervene["Create Interventions"]
        Approve["Approve / Flag Assessments"]
    end

    Gen --> Print --> Scan --> Grade
    Upload --> Print
    Record --> Whisper --> Analyze --> PhilIRI
    SkillGap --> Approve
    Recovery --> Approve
    Progress --> Approve
    Import --> List --> Edit
```

---

## 4. OMR Scanning Pipeline

```mermaid
flowchart TB
    Upload["Teacher uploads\nscanned bubble sheet image"]
    API["POST /api/teacher/omr"]
    Python["POST localhost:8000/omr/detect"]
    OpenCV["OpenCV Pipeline:\n1. Fiducial detection\n2. Perspective warp\n3. Bubble grid extraction\n4. Disk-mask fill scoring"]
    Fallback["JS Simulation Fallback\nif Python service is down"]

    API --> Python
    Python --> OpenCV
    Python -.->|service down| Fallback

    OpenCV --> Answers["Detected Answers\nA, B, _, D, ..."]
    Fallback --> Answers

    Answers --> Key["Load AnswerKey\nby subject"]
    Key --> Score["Score MC items\n+ flag written items"]

    Score --> Partial{Has written\nitems?}
    Partial -->|No| Complete["gradingStatus: complete\nAuto-scored"]
    Partial -->|Yes| Pending["gradingStatus: partial\nMC scored, written pending"]

    Pending --> TeacherGrade["Teacher grades written\nvia scoring modal"]
    TeacherGrade --> PATCH["PATCH /assessments/:id/written"]
    PATCH --> Final["Final score:\nmcCorrect + writtenScore / totalItems"]
```

---

## 5. Reading Fluency Pipeline (Phil-IRI)

```mermaid
flowchart LR
    Read["Student reads\npassage aloud"]
    Rec["Record audio\nMediaRecorder / mic"]

    subgraph TeacherSide["Teacher Path"]
        T_Upload["Upload audio file"]
        T_Analyze["POST /api/teacher/reading/analyze"]
    end

    subgraph StudentSide["Student Path"]
        S_Analyze["POST /api/student/reading/analyze"]
    end

    Whisper["Groq Whisper STT\nraw transcript"]
    Features["Python Librosa Features\nPOST /reading/analyze\nWPM, pause ratio,\nhesitations, pacing"]
    WER["Word Error Rate\nLevenshtein distance"]
    PhilIRI["Phil-IRI Classification"]
    Store["Save to LearnerRecord\n+ Assessment"]

    Read --> Rec
    Rec --> T_Analyze
    Rec --> S_Analyze
    T_Analyze --> Whisper
    S_Analyze --> Whisper
    Whisper --> Features
    Features --> WER
    WER --> PhilIRI

    PhilIRI --> Ind["Independent\n96%+ accuracy, fluent"]
    PhilIRI --> Ins["Instructional\n91-95% accuracy"]
    PhilIRI --> Fru["Frustration\n90% or less accuracy"]
    PhilIRI --> NR["Non-Reader\nbelow 80%"]

    Ind --> Store
    Ins --> Store
    Fru --> Store
    NR --> Store
```

---

## 6. Student Portal Flow

```mermaid
flowchart TB
    Login["Login as Student"]
    Home["Student Home\n/student"]
    OMR["OMR Assessments\n/student/omr-assessments"]
    ReadFlu["Reading Fluency\n/student/reading-fluency"]
    Comp["Comprehension\n/student/comprehension"]
    Interv["Interventions\n/student/interventions"]
    Prog["My Progress\n/student/progress"]

    Login --> Home
    Home --> OMR
    Home --> ReadFlu
    Home --> Comp
    Home --> Interv
    Home --> Prog

    OMR -->|View assigned exams| Results["See OMR results\nauto-graded"]
    ReadFlu -->|Record self| SelfGrade["Self-assessed\nPhil-IRI result"]
    Comp -->|Take quiz| CompScore["Comprehension score"]
    Interv -->|Mark as Done| Complete["PATCH intervention\npending teacher review"]
    Prog -->|Timeline view| Trends["Progress trends\nover time"]
```

---

## 7. Principal Dashboard Flow

```mermaid
flowchart TB
    Login["Login as Principal"]
    Home["Principal Home\n/principal"]

    subgraph Monitor["Monitoring"]
        AtRisk["At-Risk Learners"]
        ReadLvl["Reading Levels\nPhil-IRI distribution"]
        Subj["Subject Analysis\n+ K-Means Groups"]
        Trends["Progress Trends\nBOSY / MOSY / EOSY"]
    end

    subgraph Data["Data Views"]
        Records["Learner Records\nsearchable"]
        Reports["Reports\nexportable"]
        Users["User Management\nCRUD"]
        Audit["Audit Log\nactivity trail"]
    end

    Login --> Home
    Home --> Monitor
    Home --> Data

    AtRisk -->|Filter by grade/section| RiskList["High / Medium / Low risk\n+ intervention count"]
    ReadLvl --> Donut["Donut chart\n+ stacked bar by grade"]
    Subj --> Clusters["High Performing /\nOn Track / Needs Support"]
    Trends --> TimeSeries["Line charts\ntime-filtered"]
    Audit --> LogTable["Role + action filters\nlatest 200 entries"]
```

---

## 8. Data Model Relationships

```mermaid
erDiagram
    User ||--o{ Assessment : "creates / takes"
    User ||--o{ LearnerRecord : "has"
    User ||--o{ Intervention : "assigned / creates"
    User ||--o{ AuditLog : "performs"

    Assessment }o--|| AnswerKey : "graded against"
    Assessment }o--o| CustomExam : "from optional"
    AnswerKey }o--o{ Question : "references"
    AnswerKey }o--o| ReadingPassage : "for reading exam"

    LearnerRecord ||--o{ Assessment : "contains scores"
    LearnerRecord ||--o{ Intervention : "linked to"

    Question }o--|| User : "created by seed"
```

---

## 9. Intervention Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created : Teacher creates
    Created --> Active : Auto on creation
    Active --> StudentCompleted : Student marks done
    Active --> TeacherCompleted : Teacher completes
    StudentCompleted --> Reviewed : Teacher reviews
    Reviewed --> Approved : Teacher approves
    Reviewed --> Flagged : Teacher flags

    Approved --> [*]
    Flagged --> Active : Reassign
    TeacherCompleted --> [*]
```

---

## 10. Complete Request Flow (Typical OMR Exam)

```mermaid
sequenceDiagram
    actor T as Teacher
    participant UI as Teacher UI
    participant API as Next.js API
    participant DB as MongoDB
    participant PY as Python Service

    T->>UI: Click Generate 50-item Exam
    UI->>API: POST /questionnaire/generate
    API->>DB: Query Questions from bank
    DB-->>API: 51-63 questions per combo
    API->>API: Difficulty-balanced sampling
    API->>DB: Save AnswerKey
    API-->>UI: Generated questionnaire + answer key

    T->>UI: Print Questionnaire + Bubble Sheet
    T->>T: Students answer on paper
    T->>UI: Upload scanned image
    UI->>API: POST /api/teacher/omr
    API->>PY: POST /omr/detect
    PY->>PY: OpenCV detect, warp, grid, score
    PY-->>API: Detected answers array
    API->>DB: Find AnswerKey by subject
    API->>API: Compare answers vs key
    API->>DB: Save Assessment

    alt Has written items
        API-->>UI: written items need grading
        T->>UI: Open scoring modal, enter scores
        UI->>API: PATCH /assessments/:id/written
        API->>API: Recompute final score
        API->>DB: Update Assessment status complete
    end

    API->>DB: Update LearnerRecord mastery and risk
    API->>DB: Create AuditLog entry
    API-->>UI: Updated results
```
