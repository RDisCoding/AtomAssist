After reading the problem statement, I think many teams are going to misunderstand what Atomberg is actually testing here. This is **not just a video-calling app challenge**. They are evaluating whether you can design a **customer support platform** that happens to use video as the communication medium. The distinction matters because the scoring heavily favors architecture, reliability, role management, persistence, and operational thinking—not just whether two webcams can connect. 

The first thing they care about is the **end-to-end support workflow**. Imagine an Atomberg support agent receives a complaint. The agent creates a support session, sends a link to the customer, the customer joins, both can talk through video, exchange messages, troubleshoot the issue, and later the company can review what happened. That entire lifecycle is the product they want. If your demo only shows "User A calls User B," you'll likely miss the business context they're evaluating. 

One requirement that stands out is their statement that **media must route through your own server and direct peer-to-peer is not acceptable**. This is probably the most technically important line in the entire document. Many hackathon teams will build standard WebRTC peer-to-peer video calls. Atomberg explicitly says that is not allowed. They want a server in the media path (typically SFU/MCU style architecture). The reason is that customer support recordings, monitoring, analytics, and future enterprise controls become much easier when media passes through infrastructure you control. 

For session management, they want something closer to a ticketing workflow than a simple meeting room. An agent should be able to create a session, generate an invite link or token, track participants joining and leaving, terminate sessions cleanly, and most importantly store session history. When judges test the system, they may ask questions like: "Can you show me who joined this session yesterday?" or "How long was the call?" If that information isn't stored, you'll lose points even though the video works. 

The role system is another area where they are likely to test aggressively. They specifically define two roles: Agent and Customer. The agent creates sessions, starts calls, ends calls, and controls recording. Customers can only join existing sessions. During judging, someone may intentionally try to use customer credentials and access agent-only actions. If that succeeds, it directly violates the requirements. This tells me they're looking for proper authorization and not just frontend button hiding. 

The chat requirement looks simple on the surface, but notice that they want messages to be both **real-time and persistent**. That means a WebSocket message alone isn't enough. Messages should be stored in a database and retrievable after the call ends. A good demo would include a "Session Details" page where judges can open an old session and see the entire conversation history. 

The bonus features reveal what kind of engineers they value. Call recording shows operational thinking. File sharing demonstrates storage design. Reconnect handling demonstrates resilience. The admin dashboard demonstrates system visibility. Observability demonstrates production-readiness. If I were a judge, I would view reconnect handling and the admin dashboard as more impressive than basic file upload because they show understanding of real-world systems. 

The evaluation criteria are actually very revealing. Functionality is only one-sixth of the score. Reliability, architecture, UX, bonus features, and code quality each receive equal attention. This means a team with a slightly less polished video implementation but excellent architecture, logging, persistence, access control, and observability could easily outperform a team that only focused on the video stream. 

The reliability section tells you exactly what judges may try during the demo. Expect tests such as refreshing the browser, opening the invite link twice, using an invalid token, disconnecting the network temporarily, joining after the session is closed, or trying unauthorized actions. If your application gracefully handles these situations and displays meaningful error messages instead of crashing, you'll score well. 

The architecture score is where your architecture diagram becomes critical. They want evidence that you've separated concerns properly. A diagram should clearly show frontend, backend API, authentication layer, signaling server, media server, database, storage, and monitoring. Judges want confidence that the design could support many simultaneous support sessions rather than just a single demo room. 

The UX criterion suggests that judges will roleplay as ordinary customers. If joining requires technical knowledge, complicated setup, or confusing steps, you'll lose points. Ideally, a customer should click a link and join immediately. Clear status messages like "Agent joined," "Recording active," "Connection lost, reconnecting..." help significantly. 

Finally, pay close attention to the submission section because it explains why they asked for a single document. They need:

* Working demo URL
* Source code repository
* Architecture diagram
* Credentials or role-switching method
* README/setup information

The remark you received ("submit only 1 document containing working link, source code repository and architecture diagram") is essentially a condensed version of those deliverables. They want one place where a judge can find everything without hunting through emails and attachments. 

Given the problem statement and the fact that this is a hackathon, I would optimize for **fast execution, minimal configuration, production-like architecture, and easy deployment** rather than chasing the "perfect" enterprise stack.

The biggest challenge isn't actually the frontend or backend. It's the requirement that **media must pass through your own server instead of peer-to-peer WebRTC**. If you try to build an SFU from scratch, you'll waste most of the hackathon. Instead, use an open-source media server and focus your effort on the platform around it.

### Recommended Tech Stack

For the frontend, I'd use **Next.js + TypeScript + TailwindCSS + shadcn/ui**. You already have experience with React and modern web development, so you'll move much faster than learning something new.

For the backend, I'd use **Node.js + Express + Socket.IO**. This keeps your API, authentication, session management, signaling, and chat all in JavaScript/TypeScript.

For the database, use **PostgreSQL with Prisma ORM**. Prisma removes a huge amount of database boilerplate and gives you clean models for sessions, users, messages, recordings, and logs.

For authentication, use **JWT + Role-Based Access Control (RBAC)**.

For video, use **mediasoup**.

This is probably the most important technology decision.

The document explicitly forbids Twilio, Agora, Daily, Vonage, etc. Since media must pass through your own server, mediasoup is one of the best choices because:

* Open source
* Production proven
* Server-routed media
* Large community
* Works with WebRTC
* Doesn't force you to build an SFU yourself

For file uploads and recordings, use:

* Local storage during development
* S3-compatible storage (MinIO) if needed

For deployment:

* Frontend → Vercel
* Backend → Render/Railway
* PostgreSQL → Neon/Supabase

This stack can realistically be deployed in a few hours.

---

# Phase 1: Build The Skeleton First

Don't touch video yet.

Most teams immediately jump into WebRTC and get stuck.

Instead, build the business workflow first.

Create:

* Agent login
* Customer invite link
* Session creation
* Session join
* Session list
* Session history

At the end of this phase, an agent should be able to create a support session and send a URL to a customer.

Even though there is no video yet, the entire support workflow should already exist.

Database tables:

* Users
* Sessions
* Participants
* Events

This gives you the foundation for everything else.

---

# Phase 2: Real-Time Infrastructure

Now add Socket.IO.

Build:

* User presence
* Join room
* Leave room
* Session state updates

When a customer joins:

* Agent sees them appear instantly

When someone disconnects:

* UI updates immediately

Also start storing events:

* Joined
* Left
* Reconnected
* Session ended

This phase gives you most of the "reliability" points from the judging criteria.

By the end:

* Real-time updates work
* Session tracking works
* Event logs work

Still no video.

That's okay.

---

# Phase 3: Video Calling (Highest Risk Area)

Now integrate mediasoup.

Flow:

Customer Browser
↓
WebRTC
↓
Mediasoup Server
↓
WebRTC
↓
Agent Browser

Notice:

No direct browser-to-browser connection.

This satisfies the requirement.

Implement only:

* Camera on/off
* Microphone mute/unmute
* Join video room
* Leave video room

Don't worry about screen sharing, virtual backgrounds, noise suppression, etc.

The judges only care that:

* Agent can see customer
* Customer can see agent
* Audio works
* Video works

If this phase succeeds, you've already completed most mandatory requirements.

---

# Phase 4: Chat + Persistence

Now implement the easiest mandatory feature.

Add:

* In-call chat
* Message persistence
* Chat history

Schema:

Messages

* id
* sessionId
* senderId
* message
* timestamp

When a session ends:

Judges should be able to open Session Details and see:

* Call duration
* Participants
* Join/leave timeline
* Chat history

This makes your project feel much more complete.

Many teams forget persistence.

You shouldn't.

---

# Phase 5: Bonus Features That Maximize Judge Impact

This is where you earn separation from other teams.

Priority order:

### 1. Admin Dashboard

Highest ROI.

Show:

* Active sessions
* Online participants
* Session duration
* End session button

Judges love dashboards because they instantly demonstrate architecture.

---

### 2. Reconnect Handling

Implement a 30-second grace period.

Connection lost:

* Mark user as reconnecting
* Keep session alive

Reconnect within 30 seconds:

* Restore session

This directly addresses a scoring criterion mentioned in the document.

---

### 3. File Sharing

Simple upload button.

Store:

* PDFs
* Images
* Documents

Attach them to sessions.

Easy to demo.

---

### 4. Recording

Only attempt this if everything else is finished.

Recording in media systems often introduces bugs and deployment issues.

For hackathon scoring:

Admin Dashboard + Reconnect Handling will likely earn more points than a half-working recording feature.