We've successfully deployed almost the entire infrastructure stack and systematically eliminated most deployment-related issues. The current status is:

* Frontend deployed on Vercel and accessible.
* Backend deployed on AWS EC2 and reachable.
* Neon PostgreSQL database connected and functioning.
* Prisma database schema synchronized.
* Authentication working correctly.
* Session creation and dashboard functionality working.
* HTTPS configured using Nginx + Let's Encrypt + sslip.io domain.
* Mixed-content issues for backend API calls resolved.
* Media server (Mediasoup) deployed and running under PM2.
* Mediasoup worker successfully starts without crashes.

The original issue was that the frontend hosted on HTTPS (Vercel) was trying to communicate with HTTP backend/media endpoints, causing browser mixed-content blocking. We fixed this by introducing Nginx as a reverse proxy and obtaining SSL certificates. Backend requests now successfully go through:

[https://13.233.194.58.sslip.io](https://13.233.194.58.sslip.io/)

and authentication immediately started working after that change.

The second issue discovered was a Mediasoup deployment bug. The media server was configured with:

announcedIp: '127.0.0.1'

which is incorrect for production deployment because browsers outside the EC2 machine cannot connect to localhost. This was changed to:

announcedIp: '13.233.194.58'

After the change, Mediasoup workers started correctly and transport creation became theoretically possible.

We then discovered that media traffic was still failing due to HTTPS restrictions. To solve that, we created an Nginx proxy route:

location /media/

which forwards traffic to the media server running on localhost:5000. We updated:

NEXT_PUBLIC_MEDIA_URL

to:

[https://13.233.194.58.sslip.io/media](https://13.233.194.58.sslip.io/media)

and redeployed the frontend.

At this point, all mixed-content errors disappeared completely.

Despite all deployment issues being resolved, cameras still do not work.

The most important finding is that the media server never receives any Socket.IO connections.

The media server code contains:

console.log(`Media signaling connected: ${socket.id}`);

inside:

io.on('connection', ...)

However, after repeated testing, PM2 logs for the media server show only:

Media Server running on port 5000
Mediasoup worker created [pid: ...]

and absolutely nothing else.

This means that the browser is never successfully reaching the media Socket.IO server.

We confirmed that the frontend does create a dedicated media socket:

const mSocket = io(
process.env.NEXT_PUBLIC_MEDIA_URL || '[http://localhost:5000](http://localhost:5000/)',
{ auth: { user: parsedUser } }
);

and that the Mediasoup workflow is definitely present in the frontend code.

The frontend is calling:

getRouterRtpCapabilities
createWebRtcTransport
connectTransport
produce
consume
resumeConsumer
new-producer
getProducers

which means the Mediasoup implementation itself exists and is not missing.

However, network inspection shows all Socket.IO traffic being routed through:

wss://13.233.194.58.sslip.io/socket.io/

instead of:

wss://13.233.194.58.sslip.io/media/socket.io/

This strongly suggests that the media socket is either:

1. Not actually using NEXT_PUBLIC_MEDIA_URL correctly.
2. Falling back internally to the default Socket.IO path.
3. Being routed by Nginx to the backend Socket.IO server instead of the media server.
4. Using a path configuration mismatch between frontend, Nginx, and Socket.IO.

Evidence supporting this:

* Browser websocket connections are successfully established (101 Switching Protocols).
* Backend websocket connections appear active.
* Media server never logs a connection.
* No router creation logs appear.
* No producer creation logs appear.
* No consumer creation logs appear.
* No "new producer" events appear.

Therefore, the Mediasoup signaling layer is likely not even starting.

Another issue discovered is AWS networking.

The Mediasoup worker is configured with:

rtcMinPort: 40000
rtcMaxPort: 49999

but the AWS security group originally only exposed:

UDP 10000-10100

This means even if signaling succeeds, media packets cannot traverse the network.

A new inbound security-group rule should be added:

Type: Custom UDP
Port Range: 40000-49999
Source: 0.0.0.0/0

This should be added in addition to the existing UDP rule, not as a replacement.

At this point deployment itself appears successful. The remaining problem is no longer infrastructure-related. The likely root cause is in one of the following areas:

1. Socket.IO path mismatch between frontend and media server.
2. Nginx routing media websocket traffic incorrectly.
3. Frontend mediasoup-client connecting to backend Socket.IO instead of media Socket.IO.
4. Mediasoup transport initialization never being reached because the media socket connection is never established.
5. Possible WebRTC transport configuration issue after signaling succeeds.

Recommended next debugging step:

Add detailed logging inside media-server/src/index.ts for every signaling event:

connection
getRouterRtpCapabilities
createWebRtcTransport
connectTransport
produce
consume
resumeConsumer

and verify whether any of those events are ever triggered.

If none are triggered, the issue is definitively in socket routing or connection setup.

If they are triggered, the next step is debugging transport creation, producer creation, and consumer creation individually.

In summary, deployment is approximately 95% complete. Authentication, database, sessions, backend APIs, SSL, and frontend are all functioning. The remaining blocker is isolated to the Mediasoup signaling/media layer and is most likely a routing or Socket.IO path configuration issue rather than an AWS deployment issue.
