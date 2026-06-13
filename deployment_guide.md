# AtomAssist Production Deployment Guide

Deploying a real-time WebRTC architecture like AtomAssist requires a specific networking setup. Because Mediasoup requires opening a large block of UDP ports for video streaming, **the backend cannot be deployed on a standard Serverless platform like Railway.** 

The entire Node.js backend (Express + Socket.IO + Mediasoup) must be deployed directly onto your **AWS EC2 instance**.

Here is your exact step-by-step playbook:

## Phase 1: Database (Neon.tech)
1. Go to [Neon.tech](https://neon.tech/) and create a new PostgreSQL project.
2. Under your project dashboard, find the **Connection String** (it starts with `postgresql://...`).
3. Copy this string. You will need it for the EC2 backend.

## Phase 2: Backend & WebRTC Server (AWS EC2)
1. **Launch the Instance**: Spin up an **Ubuntu** EC2 instance on AWS (t3.small or t3.medium recommended for WebRTC).
2. **Configure Security Groups (CRITICAL)**: You must open the following ports in your EC2 Security Group:
   - `TCP 22` (SSH)
   - `TCP 80 & 443` (HTTP/HTTPS)
   - `TCP 4000` (Node.js API & Socket.IO)
   - `UDP 10000 - 10100` (Mediasoup WebRTC traffic)
3. **SSH into the Instance & Setup**:
   ```bash
   # Install Node.js & Git
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs git build-essential

   # Clone your repository
   git clone https://github.com/RDisCoding/AtomAssist.git
   cd AtomAssist/backend

   # Install dependencies
   npm install

   # Setup Environment Variables
   nano .env
   ```
4. **Environment Variables**: Paste the following into the `.env` file and save:
   ```env
   DATABASE_URL="your-neon-postgres-connection-string"
   PORT=4000
   MEDIASOUP_LISTEN_IP="0.0.0.0"
   MEDIASOUP_ANNOUNCED_IP="YOUR_EC2_PUBLIC_IP_ADDRESS"
   JWT_SECRET="your-super-secret-key"
   ```
5. **Sync Database & Start Server**:
   ```bash
   npx prisma db push
   npx prisma generate
   npm run build
   
   # Use PM2 to keep the server running forever
   sudo npm install -g pm2
   pm2 start dist/index.js --name atomassist-backend
   ```
*Note: Note down your EC2's Public IP Address.*

## Phase 3: Frontend (Vercel)
*(Note: I just pushed a patch to your GitHub that strips out the hardcoded `localhost:4000` URLs and replaces them with environment variables so Vercel can safely route to your EC2 instance!)*

1. Go to [Vercel](https://vercel.com/) and click **Add New Project**.
2. Import your `AtomAssist` GitHub repository.
3. In the project configuration, set the **Root Directory** to `frontend`.
4. Open the **Environment Variables** section and add:
   - `NEXT_PUBLIC_API_URL`: `http://YOUR_EC2_PUBLIC_IP_ADDRESS:4000`
5. Click **Deploy**.

## Phase 4: Final Validation
Once Vercel finishes deploying, open your live frontend URL. Log in using your dummy credentials (`admin@atomberg.com`, `password123`) and verify the dashboard successfully connects to your EC2 backend and fetches the PostgreSQL session data!

> [!WARNING] 
> For a full production launch, you will eventually want to put your EC2 backend behind an Nginx reverse proxy to secure it with an SSL certificate (`https://` and `wss://`). Browsers require secure contexts (HTTPS) to access the camera and microphone. Vercel automatically provides HTTPS for your frontend.
