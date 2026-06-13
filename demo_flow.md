# AtomQuest Hackathon: Demo Video Flow Script

This script is designed to help you record a smooth, comprehensive 3-minute demo video of the Atomberg Customer Support Platform. Follow these steps chronologically to showcase the platform's full capabilities to the judges.

## Prerequisites Before Recording
1. Ensure all three services are running (`Main Backend`, `Media Server`, `Frontend`).
2. Have PostgreSQL running with an empty or fresh database.
3. Open two browser windows: 
   - **Window 1 (Main)**: Chrome (Normal Mode) for the Agent.
   - **Window 2 (Secondary)**: Chrome (Incognito Mode) for the Customer.
4. Have your screen recording software set to record the entire screen so both windows are visible.

---

## 🎬 The Demo Flow

### Phase 1: Agent Onboarding & Dashboard (0:00 - 0:30)
1. **Action**: Open the Main Window to `http://localhost:3000`.
2. **Narration**: *"Welcome to the Atomberg Customer Support Platform. We'll start by logging in as a support agent. The system provisions an agent account automatically for this demo."*
3. **Action**: Enter `agent@atomberg.com` and a name, then click **Login**.
4. **Action**: Once on the dashboard, point out the empty state.
5. **Narration**: *"Here is the Agent Dashboard. We can see our active sessions. Let's create a new support session for a customer having trouble with their ceiling fan."*
6. **Action**: Create a new session titled "Broken Ceiling Fan".
7. **Action**: Click the **"Copy Invite Link"** button on the newly created session.

### Phase 2: Customer Join Flow (0:30 - 1:00)
1. **Action**: Switch to the Incognito Window (Customer). Paste the invite link into the URL bar and hit enter.
2. **Narration**: *"Now, acting as the customer, we open the secure invite link sent by the agent. The customer doesn't need a complex account—just their name and email to join the session."*
3. **Action**: Enter `customer@example.com` and "Jane Doe" as the name. Click **Join Session**.
4. **Action**: Both windows should now show the Session Room.
5. **Narration**: *"Both users are now in the dual-socket Session Room. You can see the participant list update in real-time on both screens via our signaling server."*

### Phase 3: Video Calling & WebRTC (1:00 - 1:45)
1. **Narration**: *"The core of this platform is the high-performance Selective Forwarding Unit (SFU) powered by Mediasoup. Let's turn on the cameras."*
2. **Action**: In the Agent window, click **Start Camera**.
3. **Action**: Wait a second, then in the Customer window, click **Start Camera**.
4. **Action**: Point out the dynamic grid layout scaling.
5. **Narration**: *"Notice how the video grid dynamically resizes. Since we are using an SFU architecture, bandwidth is preserved massively compared to standard Peer-to-Peer networks."*
6. **Action**: In the Agent window, click **Turn Video Off**.
7. **Narration**: *"We have real-time media state syncing. When the agent turns off their video or mutes their mic, the UI instantly reflects a 'Camera Off' state and 'Muted' tag across all connected browsers."*

### Phase 4: Real-Time Chat & Persistence (1:45 - 2:15)
1. **Action**: In the Customer window, type into the chat: *"Hi, my fan is making a weird clicking noise."* and hit send.
2. **Action**: Show it appear instantly in the Agent window.
3. **Action**: In the Agent window, reply: *"I can help with that, please point your camera at the motor."*
4. **Narration**: *"Alongside video, we have real-time text chat. This isn't just ephemeral—every message is persisted to our PostgreSQL database via Prisma. If a user refreshes or disconnects, the chat history is immediately fetched upon reconnecting."*

### Phase 5: The Admin Command Center (2:15 - 2:45)
1. **Action**: Open a new tab in the Main Window and navigate to `http://localhost:3000/admin`.
2. **Narration**: *"For supervisors, we've built a global Admin Command Center. This dashboard polls the backend to show a live overview of all ongoing support sessions, the assigned agents, and exactly who is in the room."*
3. **Action**: Show the "Broken Ceiling Fan" session card in the Admin UI with the "ACTIVE" badge.

### Phase 6: Conclusion (2:45 - 3:00)
1. **Action**: Switch back to the Agent window and click **Leave Call**.
2. **Narration**: *"When the issue is resolved, the agent can terminate the session. This kicks all participants securely and closes the WebRTC transports, freeing up server resources."*
3. **Action**: Show that the Customer window was redirected to the home page automatically.
4. **Narration**: *"And that concludes the AtomQuest Support Platform demo. Thank you."*

---

## 💡 Tips for Recording
* **Pacing**: Move deliberately. Don't rush clicks, give the video streams a second to load so the judges can see the latency.
* **Fallback**: If the camera fails to load because another app (like Zoom/OBS) is using it, ensure your browser has camera permissions, or use a virtual camera software.
* **Errors**: If a red error pops up during recording, just pause, fix it, and restart the recording. Hackathon judges care about the final polished flow!
