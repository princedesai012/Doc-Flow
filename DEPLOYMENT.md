# Deployment Guide for DocuFlow

This project consists of two parts:
1.  **Server (Backend)**: Node.js, Express, Socket.io, WhatsApp Web.js
2.  **Client (Frontend)**: React, Vite

We recommend deploying the **Server** to **Render** (as a Docker service) and the **Client** to **Vercel**.

---

## Part 1: Deploying the Server (Backend)

Because the server uses `whatsapp-web.js`, it requires a specific environment (Linux libraries for Chrome). We have created a `Dockerfile` in the `server` folder to handle this automatically.

### Steps:
1.  **Push your code to GitHub**. Make sure this project is in a GitHub repository.
2.  **Create a Cloudinary Account** (if you haven't already) and get your `Cloud Name`, `API Key`, and `API Secret`.
3.  **Create a MongoDB Atlas Database** and get your Connection String (`MONGO_URI`).
4.  **Sign up/Log in to [Render](https://render.com)**.
5.  Click **"New +"** -> **"Web Service"**.
6.  Connect your GitHub repository.
7.  **Configuration**:
    *   **Root Directory**: `server`
    *   **Runtime**: `Docker` (Important! Do not select Node)
    *   **Region**: Choose one close to you (e.g., Singapore/India if available, or Europe).
    *   **Instance Type**: Free (might be slow for WhatsApp) or Starter (recommended).
8.  **Environment Variables** (Scroll down to "Advanced"):
    *   Add the following variables:
        *   `MONGO_URI`: Your MongoDB connection string.
        *   `CLOUDINARY_CLOUD_NAME`: Your Cloudinary Cloud Name.
        *   `CLOUDINARY_API_KEY`: Your Cloudinary API Key.
        *   `CLOUDINARY_API_SECRET`: Your Cloudinary API Secret.
        *   `FRONTEND_URL`: (You will get this *after* deploying the frontend, e.g., `https://your-app.vercel.app`. For now, put `http://localhost:5173`)
        *   `PORT`: `5000` (Optional, Render sets generic 10000, but our code uses 5000 default. Our Dockerfile handles this).
9.  Click **"Create Web Service"**.
10. Wait for the build to finish. Once done, copy the **Service URL** (e.g., `https://docuflow-server.onrender.com`).

---

## Part 2: Deploying the Client (Frontend)

1.  **Sign up/Log in to [Vercel](https://vercel.com)**.
2.  Click **"Add New..."** -> **"Project"**.
3.  Import your GitHub repository.
4.  **Configuration**:
    *   **Root Directory**: Click "Edit" and select `client`.
    *   **Framework Preset**: Vite (should detect automatically).
5.  **Environment Variables**:
    *   Add the following variables:
        *   `VITE_API_URL`: The URL of your deployed Server (from Part 1) + `/api` (e.g., `https://docuflow-server.onrender.com/api`).
        *   `VITE_SOCKET_URL`: The URL of your deployed Server (e.g., `https://docuflow-server.onrender.com`).
6.  Click **"Deploy"**.
7.  Once deployed, you will get a **Domain** (e.g., `https://docuflow-app.vercel.app`).

---

## Part 3: Final Configuration

1.  Go back to **Render** (Server) -> **Environment Variables**.
2.  Update the `FRONTEND_URL` variable with your new Vercel domain (e.g., `https://docuflow-app.vercel.app`).
3.  **Redeploy** the Server (Manual Deploy -> Deploy latest commit) to apply the change.

---

## Troubleshooting

*   **WhatsApp Login**:
    *   Open your deployed Admin Dashboard (on Vercel).
    *   Wait for the QR Code to appear (it might take a minute as the server starts up Puppeteer).
    *   Scan it with your phone.
    *   **Note**: On the Free Tier of Render, the server might "spin down" after inactivity. It will take 1-2 minutes to wake up when you first access it.
*   **Upload Errors**:
    *   Check the Render logs. Ensure `CLOUDINARY` variables are correct.
