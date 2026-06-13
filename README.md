# Atomberg Customer Support Platform (AtomQuest)

This project is a comprehensive, end-to-end customer support platform designed for the AtomQuest Hackathon. It enables Atomberg's support agents to conduct real-time, browser-based video calls with customers. The system is engineered to handle session lifecycle management, real-time presence, chat persistence, and high-performance WebRTC media routing.

## 🏗️ Architecture Overview

The platform is divided into three distinct, decoupled microservices to ensure scalability and reliability:

1. **Frontend (Next.js 15, App Router)**: The client-facing UI for both Agents and Customers.
2. **Main Backend (Node.js, Express, Prisma)**: The central API responsible for authentication, database persistence, and Socket.IO-based chat/presence.
3. **Media Server (Node.js, Mediasoup)**: A dedicated WebRTC SFU (Selective Forwarding Unit) responsible purely for routing high-bandwidth video and audio streams between peers.

---

## 1. Frontend (Next.js)
**Path:** `/frontend`
**Tech Stack:** React, Next.js (App Router), Tailwind CSS, Shadcn/UI, Socket.IO-client, Mediasoup-client.

The frontend is a fully responsive, modern web application. It features a role-based UI that adapts depending on whether the user is an `AGENT` or a `CUSTOMER`.

### Key Features:
* **Agent Dashboard (`/dashboard`)**: Agents can view all active sessions, create new support sessions, and generate invite links for customers.
* **Customer Join Flow (`/join/[sessionId]`)**: A lightweight entry page where customers enter their details to securely join a specific call.
* **Support Session Room (`/session/[sessionId]`)**: 
  * **Dual-Socket Architecture**: Maintains simultaneous WebSocket connections to the Main Backend (for chat/events) and the Media Server (for video).
  * **Dynamic Video Grid**: Automatically resizes the video layout depending on the number of active participants.
  * **Media Controls**: Users can toggle their camera and microphone, with visual indicators (e.g., "Camera Off" placeholders, "Muted" tags) syncing globally via real-time `media-state` events.
  * **Real-time Chat**: Fully synced, database-persisted text chat inside the room.
* **Admin Command Center (`/admin`)**: A global dashboard that polls the backend to display all active/closed sessions, the assigned agents, and connected participants.

---

## 2. Main Backend (API & Signaling)
**Path:** `/backend`
**Tech Stack:** Node.js, Express, Socket.IO, Prisma ORM, PostgreSQL.

This service acts as the source of truth for all non-media data. It is designed to be deployed on serverless or PaaS environments (like Railway, Render, or Vercel).

### Key Features:
* **Relational Database Management**: Uses Prisma 7 with the `adapter-pg` to interface with PostgreSQL. Tracks `User`, `Session`, `Participant`, `Message`, and `Event` models.
* **JWT Authentication & RBAC**: Issues stateless JWT tokens to authenticate users and enforces strict Role-Based Access Control (e.g., only Agents can close a session).
* **Real-Time Presence**: Uses Socket.IO to manage "Rooms". When a user joins or leaves, the server broadcasts events, updates the participant list, and persists the timeline locally to the `Event` table.
* **Chat Persistence**: Intercepts `send-message` Socket events, writes them to the Postgres database, and broadcasts them. New users automatically fetch message history upon joining.

---

## 3. Media Server (Mediasoup SFU)
**Path:** `/media-server`
**Tech Stack:** Node.js, Express, Mediasoup (v3.19+), Socket.IO.

This service is isolated because WebRTC processing requires continuous CPU/Network utilization. It is intended to be deployed on a dedicated AWS EC2 instance.

### Key Features:
* **WebRTC Selective Forwarding Unit (SFU)**: Instead of peer-to-peer (P2P) mesh networking (which collapses with multiple users), Mediasoup accepts one media stream from a user and forwards it selectively to others, saving immense bandwidth.
* **Signaling Protocol**: Implements a highly complex Socket.IO signaling layer to negotiate `getRouterRtpCapabilities`, `createWebRtcTransport`, `connectTransport`, `produce`, and `consume`.
* **Video Catch-Up**: Maintains a global memory map of active producers (`roomProducers`). If a customer joins late, they immediately pull the existing producers and render the active cameras without requiring the agent to restart their stream.

---

## 🚀 Running Locally

To test the full suite locally, you will need **three terminal windows** running simultaneously.

### Step 1: Database & Main Backend
Ensure PostgreSQL is running locally, and your `.env` file is configured in `/backend`.
```bash
cd backend
npm install
npm run dev
```
*(Runs on `http://localhost:4000`)*

### Step 2: Media Server
```bash
cd media-server
npm install
npm run dev
```
*(Runs on `http://localhost:5000`)*

### Step 3: Frontend
```bash
cd frontend
npm install
npm run dev
```
*(Runs on `http://localhost:3000`)*

### Testing Flow
1. Open `http://localhost:3000/` and log in as an Agent.
2. Create a session in the Dashboard and copy the Invite Link.
3. Open an Incognito Window, paste the link, and join as a Customer.
4. Test the Video, Chat, and media toggles!
5. Visit `http://localhost:3000/admin` to view the global monitor.
