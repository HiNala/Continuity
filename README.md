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

Continuity is an intelligent agent system that transforms raw photographs of unfinished or existing spaces into realistic, professionally staged renovation visualizations. Unlike single-shot image generation tools that produce inconsistent or physically impossible results, Continuity uses a **multi-agent architecture** that:

- **Understands spatial constraints** — Floor drains, plumbing walls, and structural elements are identified and preserved
- **Respects immovable fixtures** — Toilets stay near floor drains, sinks stay near plumbed walls
- **Iteratively improves its own generation process** — Using Weave observability to analyze what works and what doesn't

### The Problem We Solve

Current AI image generation tools fail at architectural visualization because they treat it as a pure aesthetic problem. When you ask a model to "show me this bathroom remodeled," it produces images where:

- 🚫 Toilets appear in physically impossible locations
- 🚫 Sinks float away from plumbed walls
- 🚫 Room dimensions change unexpectedly
- 🚫 Construction debris bleeds through into "finished" outputs

**Continuity fixes this** by using a phased, constraint-aware approach with self-improvement through Weave traces.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                           │
│                    (Next.js 15 + TailwindCSS)                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API                                │
│                  (FastAPI + Python)                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Requirements│  │   Spatial    │  │      Generation        │  │
│  │    Agent    │──▶   Analysis   │──▶        Agent           │  │
│  └─────────────┘  │    Agent     │  └───────────┬────────────┘  │
│                   └──────────────┘              │               │
│                                                 ▼               │
│                              ┌──────────────────────────────┐   │
│                              │    Quality Control Agent     │   │
│                              │    (Reads Weave Traces)      │   │
│                              └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │PostgreSQL│    │  Redis   │    │  Weave   │
    │ Database │    │  Cache   │    │  Traces  │
    └──────────┘    └──────────┘    └──────────┘
```

### Agent Pipeline

1. **Requirements Agent** — Clarifies user goals through push-button questions
2. **Spatial Analysis Agent** — Extracts physical constraints from input images
3. **Generation Agent** — Transforms spaces through phased iteration:
   - Cleanup Phase → Remove debris, neutralize lighting
   - Structural Completion → Finish walls, ceiling, flooring
   - Fixture Placement → Install fixtures in correct positions
   - Style Application → Apply target styles while maintaining constraints
4. **Quality Control Agent** — Evaluates outputs and modifies the process based on Weave trace analysis

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
| `WANDB_API_KEY` | Weights & Biases API key for Weave | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Auto-configured |
| `REDIS_URL` | Redis connection string | Auto-configured |
| `BROWSERBASE_API_KEY` | Browserbase API for web automation | Optional |

### Getting API Keys

1. **Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Weights & Biases API Key**: Get from [W&B Settings](https://wandb.ai/authorize)
3. **Browserbase API Key**: Get from [Browserbase](https://www.browserbase.com/)

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
├── MISSION_01_TODO.md      # Mission tracking
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
└── missions/               # Mission specification files
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
2. Click "Test Health" to verify backend connection
3. Click "Test Database" to verify PostgreSQL
4. Click "Test Weave" to verify observability (check Weave dashboard for trace)

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
- **Google Gemini 2.0 Flash** — Image generation and vision analysis
- **Weave (W&B)** — LLM observability and tracing
- **Browserbase** — Web automation

---

## 🏆 Sponsor Technology Integration

This project showcases deep integration with hackathon sponsor technologies:

### Weave (Weights & Biases) — The Learning Substrate

Weave is not just used for logging — it's the **core mechanism** that enables self-improvement. Every significant operation is traced with `@weave.op()` decorators:

**How Weave Enables Self-Improvement:**
1. **Trace Capture**: Every Gemini API call, constraint analysis, and generation phase is recorded
2. **QC Analysis**: The Quality Control Agent programmatically queries Weave traces to understand what went wrong
3. **Policy Modification**: Based on trace analysis, the system modifies its own generation policy
4. **Feedback Loop**: Next generation uses updated policy, creating a genuine improvement loop

**What Gets Traced:**
- `requirements_agent_analyze_goal` — Goal parsing and question generation
- `spatial_agent_analyze_image` — Constraint extraction from images
- `gemini_generate_image` — Every image generation call with prompts
- `qc_compute_overall_evaluation` — Quality assessments
- `orchestrator_run_pipeline` — Full pipeline orchestration

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

### Browserbase — Web Automation Platform

Browserbase provides headless browser automation capabilities for future expansion:

**Current Integration:**
- API key testing and validation through Settings dropdown
- Foundation for future features like screenshot comparison and web-based reference gathering

**Future Use Cases:**
- Automated screenshot capture for design references
- Web scraping of furniture catalogs for style matching
- Browser-based testing of generated visualization galleries

**Configuration:**
```bash
BROWSERBASE_API_KEY=bb_live_...
BROWSERBASE_PROJECT_ID=your-project-id
```

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
