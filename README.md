# Continuity

<div align="center">

![Continuity Banner](https://img.shields.io/badge/WeaveHacks_3-Self--Improving_Agents-00a8ff?style=for-the-badge)

**Transform raw photographs into realistic, professionally staged renovation visualizations**

*A self-improving agent system that learns how to turn raw space photos into realistic, staged renovation timelines — improving its own design process using Weave observability.*

[![Built with Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Weave](https://img.shields.io/badge/Weave-Observability-FFBE00?style=flat-square&logo=weightsandbiases)](https://wandb.ai/site/weave)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)

</div>

---

## 🎯 What is Continuity?

Continuity is an intelligent agent system that transforms raw photographs of unfinished or existing spaces into realistic, professionally staged renovation visualizations. It is designed for **any interior or commercial environment** (kitchens, offices, retail, hospitality, clinics, and more). Unlike single-shot image generation tools that produce inconsistent or physically impossible results, Continuity uses a **multi-agent architecture** that:

- **Understands spatial constraints** — Plumbing, HVAC, electrical, and structural elements are identified and preserved
- **Respects immovable fixtures** — Sinks, appliances, built-ins, and utilities remain anchored to real-world constraints
- **Iteratively improves its own generation process** — Using Weave observability to analyze what works and what doesn't

### The Problem We Solve

Current AI image generation tools fail at architectural visualization because they treat it as a pure aesthetic problem. When you ask a model to "show me this space remodeled," it produces images where:

- 🚫 Fixtures shift away from plumbing or utility connections
- 🚫 Appliances and built-ins appear in impossible locations
- 🚫 Room dimensions change unexpectedly
- 🚫 Construction debris bleeds through into "finished" outputs

**Continuity fixes this** by using a phased, constraint-aware approach with self-improvement through Weave traces.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           User Interface                                     │
│                      (Next.js 15 + TailwindCSS)                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │   Image Upload      │  │  Agent Activity     │  │  Weave Trace Link   │  │
│  │   + Goal Input      │  │  Real-time Feed     │  │  Live Observability │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ SSE Stream
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Backend Orchestrator                                 │
│                        (FastAPI + Python 3.12)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     AGENT PIPELINE                                   │   │
│  │                                                                      │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │   │
│  │  │ Requirements │    │   Spatial    │    │     Generation       │   │   │
│  │  │    Agent     │───▶│   Analysis   │───▶│       Agent          │   │   │
│  │  │              │    │    Agent     │    │                      │   │   │
│  │  │ + Browserbase│    │              │    │  4-Phase Pipeline:   │   │   │
│  │  │  Inspiration │    │ Constraints: │    │  1. Cleanup          │   │   │
│  │  │   Images     │    │ - Plumbing   │    │  2. Structural       │   │   │
│  │  └──────────────┘    │ - Electrical │    │  3. Fixture          │   │   │
│  │                      │ - HVAC       │    │  4. Style            │   │   │
│  │                      │ - Structural │    └──────────┬───────────┘   │   │
│  │                      └──────────────┘               │               │   │
│  │                                                     ▼               │   │
│  │                              ┌──────────────────────────────────┐   │   │
│  │                              │     Quality Control Agent        │   │   │
│  │                              │                                  │   │   │
│  │                              │  5 Evaluation Criteria:          │   │   │
│  │                              │  • Constraint Compliance (35%)   │   │   │
│  │                              │  • Geometry Preservation (25%)   │   │   │
│  │                              │  • Hallucination Check (20%)     │   │   │
│  │                              │  • Style Execution (10%)         │   │   │
│  │                              │  • Phase Completion (10%)        │   │   │
│  │                              │                                  │   │   │
│  │                              │  Score < 0.7? → SELF-IMPROVE     │   │   │
│  │                              └──────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┬───────────────┐
          ▼               ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────────┐
    │PostgreSQL│    │  Redis   │    │  Weave   │    │Browserbase │
    │ Database │    │  Cache   │    │  Traces  │    │ Web Auto   │
    │          │    │          │    │          │    │            │
    │ Projects │    │ Policies │    │ All Ops  │    │ Inspiration│
    │ Policies │    │ Spatial  │    │ Traced   │    │ Images     │
    │ Iters    │    │ Results  │    │          │    │            │
    └──────────┘    └──────────┘    └──────────┘    └────────────┘
```

### Agent Pipeline

1. **Requirements Agent** — Clarifies user goals through smart analysis
   - Analyzes uploaded images with Gemini Vision to auto-detect space type
   - Uses **Browserbase** to fetch design inspiration images for user selection
   - Generates targeted questions only for truly ambiguous requirements
   
2. **Spatial Analysis Agent** — Extracts physical constraints from input images
   - Identifies plumbing, electrical, HVAC, and structural elements
   - Maps immovable fixtures that must be preserved
   - Results cached in Redis to avoid redundant API calls
   
3. **Generation Agent** — Transforms spaces through phased iteration:
   - **Cleanup Phase** → Remove debris, neutralize lighting
   - **Structural Completion** → Finish walls, ceiling, flooring
   - **Fixture Placement** → Install fixtures in correct positions
   - **Style Application** → Apply target styles while maintaining constraints
   
4. **Quality Control Agent** — Evaluates outputs and **modifies its own process**
   - Scores on 5 weighted criteria (constraint compliance, geometry, etc.)
   - If score < 0.70: triggers **self-improvement loop**
   - Analyzes failures, recommends changes, creates new policy version
   - All improvements logged to Weave for observability

---

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended)
- OR Node.js 18+ and Python 3.12+

### One-Command Start (Docker)

```bash
# Clone the repository
git clone <repository-url>
cd Continuity

# Copy environment file and add your API keys
cp .env.example .env
# Edit .env with your API keys (see Environment Variables below)

# Build and start all services
docker compose up --build -d

# View logs
docker compose logs -f
```

**That's it!** Open your browser to:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### Manual Start (Development)

If you prefer to run services individually:

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

#### Database (PostgreSQL)

```bash
# Using Docker for just the database
docker run -d \
  --name continuity-postgres \
  -e POSTGRES_USER=continuity \
  -e POSTGRES_PASSWORD=continuity_dev_password \
  -e POSTGRES_DB=continuity \
  -p 5432:5432 \
  postgres:16-alpine
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key for image generation | Yes |
| `GEMINI_VISION_MODEL` | Gemini model for image analysis | Optional |
| `GEMINI_IMAGE_MODEL` | Gemini model for image generation (e.g., `gemini-3-pro-image-preview`) | Optional |
| `GEMINI_IMAGE_ASPECT_RATIO` | Output aspect ratio (e.g., `16:9`) | Optional |
| `GEMINI_IMAGE_SIZE` | Output size (`1K`, `2K`, `4K`) | Optional |
| `WANDB_API_KEY` | Weights & Biases API key for Weave | Yes |
| `WANDB_ENTITY` | W&B entity/organization (optional) | Optional |
| `DATABASE_URL` | PostgreSQL connection string | Auto-configured |
| `REDIS_URL` | Redis connection string | Auto-configured |
| `BROWSERBASE_API_KEY` | Browserbase API for web automation | Optional |
| `BROWSERBASE_PROJECT_ID` | Browserbase project identifier | Optional |
| `STAGEHAND_MODEL_API_KEY` | OpenAI/Anthropic key for AI-powered browser automation | Optional |

### Getting API Keys

1. **Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Weights & Biases API Key**: Get from [W&B Settings](https://wandb.ai/authorize)
3. **Browserbase API Key**: Get from [Browserbase](https://www.browserbase.com/)
4. **Stagehand Model API Key**: Get from [OpenAI](https://platform.openai.com/api-keys) (optional, enables AI-powered web automation)

---

## 🐳 Docker Commands

```bash
# Start all services in background
docker compose up --build -d

# Stop all services
docker compose down

# View logs (all services)
docker compose logs -f

# View logs (specific service)
docker compose logs -f backend
docker compose logs -f frontend

# Rebuild a specific service
docker compose build backend
docker compose up -d backend

# Reset everything (including volumes)
docker compose down -v
docker compose up --build -d

# Access PostgreSQL CLI
docker compose exec postgres psql -U continuity -d continuity

# Access Redis CLI
docker compose exec redis redis-cli
```

---

## 📁 Project Structure

```
Continuity/
├── docker-compose.yml      # Multi-container Docker setup
├── .env.example            # Environment variable template
├── .gitignore              # Git ignore rules
├── .dockerignore           # Docker build ignore rules
├── README.md               # This file
├── docs/                   # Documentation & mission tracking
│   ├── missions/           # Mission specs
│   └── missions_todo/      # Mission checklists
│
├── frontend/               # Next.js 15 Application
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── src/
│       └── app/
│           ├── layout.tsx
│           ├── page.tsx
│           └── globals.css
│
├── backend/                # FastAPI Application
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── init.sql            # Database initialization
│   └── app/
│       ├── __init__.py
│       ├── main.py         # FastAPI application
│       ├── config.py       # Settings management
│       ├── database.py     # PostgreSQL connection
│       └── weave_ops.py    # Weave-traced operations
│
├── docs/                   # Documentation
│   └── (future documentation)
│
└── missions/               # Legacy mission specs (if present)
    └── (mission markdown files)
```

---

## 🧪 Testing the Setup

After starting the system, verify everything works:

### 1. Check Backend Health

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-31T...",
  "version": "0.1.0",
  "environment": "development"
}
```

### 2. Test Database Connection

```bash
curl http://localhost:8000/db-test
```

### 3. Test Weave Integration

```bash
curl -X POST http://localhost:8000/weave-test \
  -H "Content-Type: application/json" \
  -d '{"input_text": "Hello Continuity!"}'
```

After this call, check your [Weave Dashboard](https://wandb.ai/home) to see the trace!

### 4. Using the Frontend

1. Open http://localhost:3000
2. Create a project with any interior or commercial space (kitchen, office, retail, etc.)
3. Review the Agent Activity feed and Weave trace link for live updates

---

## 🔧 API Endpoints

### System Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API information |
| `/health` | GET | Health check |
| `/db-test` | GET | Database connectivity test |
| `/weave-test` | POST | Weave observability test |
| `/docs` | GET | Swagger API documentation |
| `/redoc` | GET | ReDoc API documentation |

### Project Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | POST | Create a new project |
| `/api/projects/{id}` | GET | Get project details |
| `/api/projects/{id}/analyze-goal` | POST | Analyze goal and get clarifying questions |
| `/api/projects/{id}/submit-answers` | POST | Submit answers to clarifying questions |
| `/api/projects/{id}/analyze-space` | POST | Run spatial analysis on project images |
| `/api/projects/{id}/generate` | POST | Run full generation pipeline |
| `/api/projects/{id}/evaluate-and-improve` | POST | Evaluate iteration and apply QC improvements |

### Orchestration Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects/{id}/start` | POST | Start full orchestrated pipeline |
| `/api/projects/{id}/status` | GET | Get orchestration status (for polling) |
| `/api/projects/{id}/submit-clarification` | POST | Submit clarification during orchestration |
| `/api/projects/{id}/retry` | POST | Retry failed orchestration |
| `/api/projects/{id}/log` | GET | Get orchestration log |

---

## 📸 Batch Processing for Virtual Staging

Continuity supports processing entire photoshoots with consistent style across all images, with **cross-scene and cross-project learning**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  BATCH PROCESSING WITH CROSS-LEARNING                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. UPLOAD FOLDER OF IMAGES                                                 │
│     └── User uploads 10 photos from a property photoshoot                   │
│                                                                             │
│  2. CROSS-PROJECT LEARNING (Automatic)                                      │
│     └── System checks: "What patterns worked in past projects?"             │
│     └── seed_policy_from_learnings() applies successful patterns            │
│     └── New batch starts with OPTIMIZED settings from past experience       │
│                                                                             │
│  3. SINGLE REQUIREMENTS GATHERING                                           │
│     └── Requirements Agent + Browserbase inspiration                        │
│     └── User defines ONE style goal for ALL images                          │
│     └── "Modern minimalist staging for entire property"                     │
│                                                                             │
│  4. CROSS-SCENE LEARNING (During Processing)                                │
│     ┌────────────────────────────────────────────────────────────────┐     │
│     │  Scene 1: Kitchen                                              │     │
│     │  ├── Generation fails QC (constraint violation)                │     │
│     │  ├── analyze_failure() → "Fixtures moved from original"        │     │
│     │  ├── apply_policy_changes() → constraint_emphasis: "high"      │     │
│     │  └── Retry succeeds → mark_improvement_effective(true)         │     │
│     │                         ↓                                      │     │
│     │  Scene 2: Bathroom  (BENEFITS FROM SCENE 1's LEARNING)         │     │
│     │  ├── Loads Policy v2 with high constraint_emphasis             │     │
│     │  └── Generates correctly on first try!                         │     │
│     │                         ↓                                      │     │
│     │  Scene 3: Living Room  (BENEFITS FROM ALL PRIOR LEARNING)      │     │
│     │  └── Uses accumulated improvements from scenes 1-2             │     │
│     └────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  5. LEARNING SUMMARY (At Completion)                                        │
│     └── record_batch_learning() logs: improvements made, scenes benefited   │
│     └── Effective patterns stored for FUTURE projects                       │
│     └── Next batch starts even smarter!                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Cross-Learning Features:**

| Feature | Within Batch | Across Projects |
|---------|--------------|-----------------|
| Policy improvements | ✅ Scene 2 uses Scene 1's improved policy | ✅ New projects seeded from past successes |
| Pattern tracking | ✅ `metadata_.policy_improvements` per scene | ✅ `improvement_observed` in PolicyChange |
| Automatic seeding | N/A | ✅ `seed_policy_from_learnings()` |
| Weave logging | ✅ `record_batch_learning()` | ✅ `record_cross_project_learning()` |
| SSE events | ✅ `scene_start`, `scene_complete`, `learning` | N/A |

**Key Features:**
- **One input → One output**: Each uploaded image produces one staged output
- **Shared requirements**: Style goals defined once, applied to all images
- **Independent processing**: Each scene has its own constraints and generation
- **Cross-scene learning**: Policy improvements from early scenes benefit later ones
- **Cross-project learning**: Effective patterns from past projects seed new ones
- **Progress tracking**: Monitor per-scene status via `/api/projects/{id}/scenes`
- **Real-time SSE events**: `scene_start`, `scene_complete`, `learning`, `batch_progress`

**Use Case: Virtual Staging Product**
```
Input: 50 photos of an unfurnished apartment
Goal: "Luxury modern staging for real estate listing"
Output: 50 professionally staged images with consistent style

Learning: If scene 5 fails and learns "high constraint emphasis works better",
          scenes 6-50 automatically use that improved setting.
          The NEXT batch of 50 photos starts with that knowledge too!
```

---

## 🎯 Mission Progress

This project is organized into missions for the hackathon:

| Mission | Status | Description |
|---------|--------|-------------|
| 01 | ✅ Complete | System Foundation & Skeleton |
| 02 | ✅ Complete | Requirements & Clarification Agent |
| 03 | ✅ Complete | Spatial Analysis Agent |
| 04 | ✅ Complete | Main Generation Agent |
| 05 | ✅ Complete | Quality Control & Optimizer Agent |
| 06 | ✅ Complete | Orchestration & Control Loop |
| 07 | ✅ Complete | Weave Integration |
| 08 | ✅ Complete | Frontend User Experience |
| 09 | ✅ Complete | Demo Readiness - System Audit |

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** — React framework with App Router
- **TypeScript** — Type-safe JavaScript
- **TailwindCSS** — Utility-first CSS framework
- **Lucide React** — Beautiful icons

### Backend
- **FastAPI** — Modern Python web framework
- **Python 3.12** — Latest Python with async support
- **SQLAlchemy** — SQL toolkit and ORM
- **Pydantic** — Data validation

### Infrastructure
- **PostgreSQL 16** — Primary database
- **Redis 7** — Caching and vector storage
- **Docker Compose** — Multi-container orchestration

### AI & Observability
- **Google Gemini (Nano Banana Pro)** — Image generation (`gemini-3-pro-image-preview`) and vision analysis (`gemini-2.0-flash`)
- **Weave (W&B)** — LLM observability, tracing, and the learning substrate for self-improvement
- **Browserbase + Stagehand** — AI-powered web automation for design inspiration
  - Browserbase provides cloud browser infrastructure
  - Stagehand adds AI layer for natural language browser control

---

## 🏆 Sponsor Technology Integration

This project showcases deep integration with hackathon sponsor technologies:

### Weave (Weights & Biases) — The Learning Substrate

Weave is not just used for logging — it's the **core mechanism** that enables self-improvement. Every significant operation is traced with `@weave.op()` decorators, creating a complete observability layer that powers the learning loop.

---

## 🧠 How Self-Improvement Actually Works

This is **not theoretical** — the system genuinely modifies its own behavior based on failures. Here's the complete verified mechanism:

### The Self-Improvement Loop (Verified & Tested)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SELF-IMPROVEMENT LOOP                                 │
│                     (Proven via test_self_improvement.py)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 1: GENERATE                                                     │   │
│  │ ─────────────────                                                    │   │
│  │ Generation Agent loads current Policy (version N) from database      │   │
│  │                                                                      │   │
│  │   Policy v1 contains:                                                │   │
│  │   ├── constraint_emphasis: "medium"                                  │   │
│  │   ├── creativity_level: 0.7                                          │   │
│  │   ├── prompt_templates: { cleanup: "...", structural: "..." }        │   │
│  │   └── phase_configs: { cleanup: {...}, fixture: {...} }              │   │
│  │                                                                      │   │
│  │   @weave.op("gemini_generate_image") traces every generation call    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 2: EVALUATE                                                     │   │
│  │ ────────────────                                                     │   │
│  │ QC Agent evaluates generated output using Gemini Vision              │   │
│  │                                                                      │   │
│  │   5 Weighted Criteria:                                               │   │
│  │   ├── Constraint Compliance  (35%)  "Did fixtures stay in place?"    │   │
│  │   ├── Geometry Preservation  (25%)  "Are room dimensions correct?"   │   │
│  │   ├── Hallucination Check    (20%)  "Any impossible elements?"       │   │
│  │   ├── Style Execution        (10%)  "Does it match target style?"    │   │
│  │   └── Phase Completion       (10%)  "Is the phase goal achieved?"    │   │
│  │                                                                      │   │
│  │   Overall Score = Weighted Average                                   │   │
│  │   PASS Threshold = 0.70                                              │   │
│  │                                                                      │   │
│  │   @weave.op("qc_compute_overall_evaluation") traces scoring          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                          Score < 0.70? ───────────────────┐                │
│                                      │                    │                │
│                              YES     │                 NO │                │
│                                      ▼                    ▼                │
│  ┌─────────────────────────────────────────────┐  ┌─────────────────────┐ │
│  │ STEP 3: ANALYZE FAILURE                     │  │ ✓ PASS              │ │
│  │ ──────────────────────────                  │  │                     │ │
│  │ QC Agent identifies WHAT went wrong         │  │ Proceed to next     │ │
│  │                                             │  │ phase or complete   │ │
│  │   qc_agent.analyze_failure() returns:       │  │ pipeline            │ │
│  │   ├── failed_criteria: ["constraint_compliance"] │                   │ │
│  │   ├── insights: [                           │  └─────────────────────┘ │
│  │   │     "Sink fixture moved from original", │                          │
│  │   │     "Constraint preservation score low",│                          │
│  │   │     "Generation ignored spatial data"   │                          │
│  │   │   ]                                     │                          │
│  │   └── recommended_changes: [                │                          │
│  │         {                                   │                          │
│  │           "type": "constraint_emphasis",    │                          │
│  │           "current": "medium",              │                          │
│  │           "recommended": "high",            │                          │
│  │           "reason": "Fixtures were moved"   │                          │
│  │         }                                   │                          │
│  │       ]                                     │                          │
│  │                                             │                          │
│  │   @weave.op("qc_analyze_failure") traces    │                          │
│  └─────────────────────────────────────────────┘                          │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 4: MODIFY POLICY                                                │   │
│  │ ─────────────────────                                                │   │
│  │ QC Agent creates NEW policy version with specific changes            │   │
│  │                                                                      │   │
│  │   qc_agent.apply_policy_changes() does:                              │   │
│  │                                                                      │   │
│  │   IF constraint_violation THEN:                                      │   │
│  │   ├── constraint_emphasis: "medium" → "high"                         │   │
│  │   └── prompt_addition: "CRITICAL: Do not move fixtures..."           │   │
│  │                                                                      │   │
│  │   IF hallucination_detected THEN:                                    │   │
│  │   └── creativity_level: 0.7 → 0.4                                    │   │
│  │                                                                      │   │
│  │   IF geometry_issue THEN:                                            │   │
│  │   └── prompt_addition: "Maintain exact room dimensions..."           │   │
│  │                                                                      │   │
│  │   Creates Policy v2:                                                 │   │
│  │   ├── constraint_emphasis: "high"        ← CHANGED                   │   │
│  │   ├── creativity_level: 0.7              (or 0.4 if hallucination)   │   │
│  │   ├── prompt_templates: { cleanup: "..." + additions }               │   │
│  │   └── is_active: true                    (v1 deactivated)            │   │
│  │                                                                      │   │
│  │   @weave.op("qc_apply_policy_changes") traces                        │   │
│  │   weave_record_improvement() logs the change for observability       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 5: RETRY WITH IMPROVED POLICY                                   │   │
│  │ ─────────────────────────────────────                                │   │
│  │ Generation Agent loads Policy v2 (new active policy)                 │   │
│  │                                                                      │   │
│  │   load_policy() returns updated configuration:                       │   │
│  │   ├── Higher constraint emphasis                                     │   │
│  │   ├── Modified prompts with preservation instructions                │   │
│  │   └── Potentially lower creativity to reduce hallucinations          │   │
│  │                                                                      │   │
│  │   Retry generation with improved parameters                          │   │
│  │   Loop continues until PASS or max_retries reached                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Proof: Test Results Showing Real Self-Improvement

```
test_self_improvement_loop PASSED
───────────────────────────────────────────────────────
│ Metric                │ Before  │ After   │ Change │
├───────────────────────┼─────────┼─────────┼────────┤
│ constraint_emphasis   │ medium  │ high    │ ✓ UP   │
│ policy_version        │ 1       │ 2       │ ✓ NEW  │
│ failed_criteria       │ 1       │ -       │ ✓ ID'd │
│ insights_count        │ 6       │ -       │ ✓ GEN  │
│ recommendations_count │ 2       │ -       │ ✓ REC  │
│ changes_applied       │ 2       │ -       │ ✓ DONE │
│ improvement_verified  │ -       │ true    │ ✓ WORK │
───────────────────────────────────────────────────────
```

### Code Paths (Verified)

| Step | File | Method | Line |
|------|------|--------|------|
| Load Policy | `generation_agent.py` | `load_policy()` | ~140 |
| Generate Image | `generation_agent.py` | `execute_*_phase()` | ~280-500 |
| Evaluate Output | `qc_agent.py` | `compute_overall_evaluation()` | ~394 |
| Analyze Failure | `qc_agent.py` | `analyze_failure()` | ~620 |
| Apply Changes | `qc_agent.py` | `apply_policy_changes()` | ~700 |
| Trigger Retry | `orchestrator.py` | `_run_phase()` | ~600 |
| Record to Weave | `weave_ops.py` | `record_policy_improvement()` | ~89 |

---

**Recommended Weave Setup:**
- Set `WANDB_ENTITY` (optional) and `WEAVE_PROJECT_NAME` to ensure traces land in the right workspace
- For image outputs, Continuity logs generated images to Weave via `log_image_media()` for visualization

**What Gets Traced:**
| Operation | Weave Op Name | Purpose |
|-----------|---------------|---------|
| Goal analysis | `requirements_agent_analyze_goal` | Parse user intent and generate questions |
| Inspiration fetch | `browserbase_fetch_inspiration` | Get design reference images |
| Image analysis | `spatial_agent_analyze_image` | Extract constraints from photos |
| Image generation | `gemini_generate_image` | Call Gemini with prompts (logged to Weave UI) |
| Quality evaluation | `qc_compute_overall_evaluation` | Score outputs on 5 criteria |
| Failure analysis | `qc_analyze_failure` | Understand what went wrong |
| Policy changes | `qc_apply_policy_changes` | Modify prompts/settings |
| Improvement record | `weave_record_improvement` | Track self-improvement events |
| Pipeline orchestration | `orchestrator_run_pipeline` | Full pipeline coordination |

**View your traces at**: [wandb.ai/home](https://wandb.ai/home)

### Redis — High-Performance Caching Layer

Redis is used for performance-critical caching and session management:

**Use Cases:**
| Feature | Purpose | TTL |
|---------|---------|-----|
| Spatial Analysis Cache | Avoid re-analyzing identical images (expensive Gemini Vision calls) | 1 hour |
| Policy Cache | Quick retrieval of active generation policy during iterations | 30 min |
| Orchestration Progress | Real-time progress tracking for frontend polling | 2 hours |
| Rate Limiting | Prevent excessive API calls to external services | Variable |

**Key Benefits:**
- **Cost Reduction**: Cached spatial analysis results avoid redundant Gemini Vision API calls
- **Speed**: Policy lookups during generation are instant from Redis
- **Real-time Updates**: Orchestration progress is updated without database writes

**Redis Service Location**: `backend/app/redis_service.py`

### Google Gemini (Nano Banana Pro) — Vision & Generation

Continuity uses Google Gemini's cutting-edge models for both image analysis and generation:

**Vision Analysis (Spatial Agent):**
- Model: `gemini-2.0-flash` (configurable via `GEMINI_VISION_MODEL`)
- Used for extracting physical constraints from uploaded photos
- Identifies: plumbing, electrical, HVAC, structural elements
- Results cached in Redis to avoid redundant API calls

**Image Generation (Generation Agent):**
- Model: `gemini-3-pro-image-preview` (Nano Banana Pro)
- Configuration follows latest API spec:
  ```python
  generationConfig = {
      "responseModalities": ["TEXT", "IMAGE"],
      "imageConfig": {
          "aspectRatio": "16:9",  # Configurable
          "imageSize": "2K"       # Options: 1K, 2K, 4K
      }
  }
  ```
- Four-phase generation: Cleanup → Structural → Fixture → Style
- Each phase uses constraint-aware prompts to prevent hallucinations

**Environment Variables:**
```bash
GEMINI_API_KEY=your_api_key
GEMINI_VISION_MODEL=gemini-2.0-flash
GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview
GEMINI_IMAGE_ASPECT_RATIO=16:9
GEMINI_IMAGE_SIZE=2K
```

### Browserbase + Stagehand — AI-Powered Design Inspiration

Browserbase provides cloud browser infrastructure, while **Stagehand** adds an AI layer for intelligent browser automation. Together, they fetch design inspiration images during requirements gathering.

**Integration Architecture:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BROWSERBASE + STAGEHAND INTEGRATION                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TIER 1: Full AI-Powered (Stagehand + Browserbase)                    │   │
│  │ ───────────────────────────────────────────────────────────────────  │   │
│  │ Requires: BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID               │   │
│  │           + STAGEHAND_MODEL_API_KEY (OpenAI or Anthropic)            │   │
│  │                                                                      │   │
│  │ Capabilities:                                                        │   │
│  │ ├── AI navigates to design websites using natural language          │   │
│  │ ├── Stagehand extracts images intelligently from any page           │   │
│  │ ├── Real-time web scraping with anti-bot handling                   │   │
│  │ └── Session tracking logged to Weave for observability              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                          (Missing MODEL_API_KEY?)                           │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TIER 2: Session Tracking Only (Browserbase)                          │   │
│  │ ───────────────────────────────────────────────────────────────────  │   │
│  │ Requires: BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID               │   │
│  │                                                                      │   │
│  │ Capabilities:                                                        │   │
│  │ ├── Creates browser sessions for analytics tracking                 │   │
│  │ ├── Logs queries to Weave via session IDs                           │   │
│  │ └── Returns curated images (fast, reliable)                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                          (Missing Browserbase keys?)                        │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TIER 3: Curated Gallery (Fallback)                                   │   │
│  │ ───────────────────────────────────────────────────────────────────  │   │
│  │ Requires: Nothing (always available)                                 │   │
│  │                                                                      │   │
│  │ Capabilities:                                                        │   │
│  │ ├── High-quality curated Unsplash images by style                   │   │
│  │ ├── Space-specific images (bathroom, kitchen, etc.)                 │   │
│  │ └── Instant response, no external dependencies                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Check Your Integration Status:**
```bash
curl http://localhost:8000/api/inspiration/status
```

**Response:**
```json
{
  "browserbase_configured": true,
  "stagehand_configured": false,
  "stagehand_available": false,
  "mode": "curated_gallery",
  "capabilities": {
    "ai_extraction": false,
    "session_tracking": true,
    "curated_images": true
  }
}
```

**How It Works in the Pipeline:**
```
┌────────────────────────────────────────────────────────────────┐
│  User: "I want a modern spa bathroom"                          │
│                          │                                     │
│                          ▼                                     │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Gemini Vision analyzes uploaded photo                   │   │
│  │ → Detects: bathroom, unfinished, existing fixtures      │   │
│  └────────────────────────────────────────────────────────┘   │
│                          │                                     │
│                          ▼                                     │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Browserbase + Stagehand fetches inspiration             │   │
│  │ → If Stagehand: AI navigates Unsplash, extracts images  │   │
│  │ → If Browserbase only: Session logged, curated returned │   │
│  │ → If neither: Curated gallery based on style/space      │   │
│  │ → Returns: 8-12 design reference images                 │   │
│  └────────────────────────────────────────────────────────┘   │
│                          │                                     │
│                          ▼                                     │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ User sees questions + inspiration gallery               │   │
│  │ → Selects preferred images to define vision             │   │
│  │ → Better requirements = better generation               │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

**API Endpoints:**
| Endpoint | Purpose |
|----------|---------|
| `POST /api/inspiration/search` | Search design inspiration images |
| `POST /api/inspiration/styles` | Get style variations with examples |
| `POST /api/inspiration/mood-board` | Create mood board from styles |
| `GET /api/inspiration/project/{id}` | Auto-generated inspiration for project |
| `GET /api/inspiration/status` | Check Browserbase/Stagehand integration status |

**Supported Design Styles:**
- Modern, Minimalist, Industrial, Japandi
- Mid-Century, Traditional, Luxury, Rustic
- Coastal, Bohemian, Scandinavian

**Configuration:**
```bash
# Tier 2: Session Tracking (Browserbase only)
BROWSERBASE_API_KEY=bb_live_...
BROWSERBASE_PROJECT_ID=your-project-id

# Tier 1: Full AI-Powered (add Stagehand)
STAGEHAND_MODEL_API_KEY=sk-...  # OpenAI or Anthropic API key
```

**What is Stagehand?**

[Stagehand](https://stagehand.dev) is an AI browser automation framework that uses natural language to control web browsers. It provides:
- **act()** — Perform actions like "click the search button"
- **extract()** — Extract structured data from pages
- **observe()** — Find interactive elements on a page

Combined with Browserbase's cloud browser infrastructure, Stagehand enables Continuity to intelligently navigate design websites and extract inspiration images without hardcoded selectors.

---

## 👥 Team

Built for **WeaveHacks 3: Self-Improving Agents Hackathon**

January 31 - February 1, 2026 at Weights & Biases HQ, San Francisco

---

## 📄 License

This project is built for a hackathon and is provided as-is.

---

<div align="center">

**Made with ❤️ for WeaveHacks 3**

[View Weave Dashboard](https://wandb.ai/home) • [API Docs](http://localhost:8000/docs) • [Report Issue](https://github.com/...)

</div>
