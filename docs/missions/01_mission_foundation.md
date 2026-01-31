# Mission 01: System Foundation & Skeleton

## Project Context

You are building Continuity, a self-improving agent system for architectural and interior design visualization. The system transforms raw photographs of unfinished or existing spaces into realistic, professionally staged renovation visualizations. Unlike single-shot image generation tools, Continuity uses a multi-agent architecture that understands spatial constraints, respects immovable fixtures, and iteratively improves its own generation process through Weave observability data.

The complete system includes a Next.js frontend, a Python FastAPI backend, multiple specialized agents (Requirements, Spatial Analysis, Generation, Quality Control), Weave instrumentation for observability, PostgreSQL for persistence, and Redis for caching. This is being built for the WeaveHacks 3 hackathon where the theme is self-improving agents.

---

## Mission Objective

Establish the minimal end-to-end skeleton of the Continuity system so all future work plugs into a functioning backbone. This mission creates the foundation that every other mission depends on. Nothing else matters unless the system boots, traces operations, and moves data end-to-end.

By the end of this mission, you will have a working frontend that can communicate with a backend, a backend that can write to a database, and Weave instrumentation proving that traces are being captured. This gives us a runnable system at all times, even if later missions are incomplete.

---

## Technology Decisions

The frontend uses Next.js 15 with TypeScript and TailwindCSS. Next.js provides the React framework with server-side rendering, API routes for backend communication, and excellent developer experience. TypeScript adds type safety. TailwindCSS enables rapid UI development.

The backend uses Python with FastAPI running in a Docker container. Python is the natural choice for AI/ML workloads and the Weave SDK. FastAPI provides a modern async web framework with automatic documentation.

PostgreSQL stores all persistent data including projects, iterations, policies, and artifacts. The schema will grow in later missions, but this mission establishes the connection and basic structure.

Weave from Weights & Biases provides observability. Every significant operation will eventually be wrapped as a Weave operation. This mission proves the integration works with a simple test operation.

---

## Requirements

You need the following environment variables configured. Create a sample environment file that documents what is needed:

- GEMINI_API_KEY for Google Gemini API access (will be used in later missions)
- WEAVE_API_KEY for Weights & Biases Weave access
- DATABASE_URL for PostgreSQL connection
- REDIS_URL for Redis connection (will be used in later missions)

The frontend should run on port 3000. The backend should run on port 8000. PostgreSQL should be accessible either locally or via container. For hackathon purposes, you may use SQLite initially if PostgreSQL setup is blocking progress, but document the switch clearly.

---

## Acceptance Criteria

This mission is complete when all of the following are true:

1. The Next.js frontend loads in a browser at localhost:3000 and displays a basic page indicating the application name "Continuity"

2. The FastAPI backend responds to requests at localhost:8000 and has a health check endpoint that returns a success status

3. The frontend can successfully call the backend API and display a response, proving the connection works

4. PostgreSQL is connected and the backend can write and read a simple test record

5. Weave is initialized and a dummy operation decorated with the Weave operation decorator appears in the Weave UI when triggered

6. All code is organized in a clear directory structure with frontend and backend separated

7. A README exists explaining how to start the system locally

---

## Step-by-Step Instructions

Before you begin any work, create a todo list file at the root of the project called MISSION_01_TODO.md. This todo list should contain every task below as a checkbox item. As you complete each task, mark it complete in the todo list. Do not consider this mission finished until every checkbox is marked complete and you have verified all acceptance criteria are met.

**Step 1: Create the project directory structure**

Create a root project directory called "continuity" with two main subdirectories: "frontend" for the Next.js application and "backend" for the FastAPI application. Also create a "docs" directory for documentation and a "missions" directory to store these mission files for reference.

**Step 2: Initialize the Next.js frontend**

Inside the frontend directory, initialize a new Next.js 15 project with TypeScript and TailwindCSS. Configure the project to use the App Router. Create a simple home page that displays "Continuity" as a heading and a brief tagline like "Self-Improving Design Visualization". Add a placeholder section where upload functionality will eventually go. The page should look clean and professional even at this early stage.

**Step 3: Initialize the FastAPI backend**

Inside the backend directory, create a Python project with FastAPI. Create a main application file that initializes FastAPI with appropriate metadata (title, description, version). Create a health check endpoint at GET /health that returns a JSON object with status "ok" and a timestamp. Create a requirements.txt or pyproject.toml listing all dependencies including fastapi, uvicorn, weave, psycopg2-binary (or asyncpg), and python-dotenv.

**Step 4: Configure environment variables**

Create a .env.example file at the project root documenting all required environment variables with placeholder values. Create actual .env files (which should be gitignored) for local development. The backend should load these variables at startup using python-dotenv or similar.

**Step 5: Set up PostgreSQL connection**

In the backend, create a database module that establishes a connection to PostgreSQL using the DATABASE_URL environment variable. Create a simple test table called "system_status" with columns for id, created_at, and message. Write a function that inserts a test record and another function that retrieves it. Create an endpoint at GET /db-test that calls these functions and returns the result, proving the database connection works.

**Step 6: Initialize Weave integration**

In the backend, create a weave module that initializes Weave with the project name "continuity". Create a simple function decorated with the Weave operation decorator that takes a string input and returns a processed string (something trivial like adding a timestamp). Create an endpoint at POST /weave-test that calls this function. When this endpoint is hit, the operation should appear in the Weave UI.

**Step 7: Connect frontend to backend**

In the frontend, create a simple API client module that can make requests to the backend. On the home page, add a button that when clicked calls the backend health endpoint and displays the response. Add another button that triggers the Weave test endpoint. This proves the frontend and backend are communicating correctly.

**Step 8: Configure CORS**

The backend must accept requests from the frontend origin. Configure CORS middleware in FastAPI to allow requests from localhost:3000. Test that the frontend can successfully call the backend without CORS errors.

**Step 9: Create startup documentation**

Write a README.md at the project root that explains how to start the system. Include instructions for installing dependencies for both frontend and backend, setting up environment variables, starting the database, and running both services. A developer should be able to clone the repo and get everything running by following the README.

**Step 10: Create Docker configuration (optional but recommended)**

Create a docker-compose.yml that defines services for the frontend, backend, and PostgreSQL. This makes it easy to spin up the entire system with one command. If time is tight, this can be skipped, but document in the README that Docker setup is pending.

**Step 11: Verify all acceptance criteria**

Go through each acceptance criterion one by one and verify it is met. Load the frontend in a browser. Hit the backend health endpoint. Click the button that connects frontend to backend. Check that the database test endpoint works. Hit the Weave test endpoint and verify the trace appears in the Weave UI. If any criterion is not met, fix the issue before considering this mission complete.

---

## Output Artifacts

By the end of this mission, the following files and directories should exist:

- continuity/frontend/ containing a working Next.js application
- continuity/backend/ containing a working FastAPI application
- continuity/README.md with setup instructions
- continuity/.env.example documenting required environment variables
- continuity/MISSION_01_TODO.md with all tasks checked off
- Optionally, continuity/docker-compose.yml for containerized deployment

---

## Important Reminders

Do not proceed to Mission 02 until this mission is fully complete. The foundation must be solid because every other mission builds on it.

Keep the code simple and clean. This is a hackathon project, so avoid over-engineering, but maintain enough structure that the codebase can grow.

Test everything as you build it. Do not write all the code and then test at the end. Build incrementally and verify each piece works before moving on.

If you encounter blockers (missing API keys, database connection issues, etc.), document them clearly and create workarounds where possible. The goal is a working system, not perfection.

---

## Do Not Stop Until

You have created the todo list, completed every item on it, and verified all acceptance criteria are met. The system must be bootable and traceable before this mission is done.
