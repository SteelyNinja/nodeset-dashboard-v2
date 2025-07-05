# Remote Access Setup Guide

This guide helps you configure the React frontend to connect to the FastAPI backend when accessing from a remote machine.

## Problem
When accessing the dashboard from a remote machine, the frontend tries to connect to `localhost:8000` (the browser's local machine), but the backend is running on your host machine.

## Solution

### Step 1: Find Your Host Machine's IP Address

On your host machine, run:
```bash
# Option 1: Get the primary IP
hostname -I | awk '{print $1}'

# Option 2: Get network interface info
ip addr show | grep 'inet ' | grep -v 127.0.0.1

# Option 3: Using ifconfig (if available)
ifconfig | grep 'inet ' | grep -v 127.0.0.1
```

Example output: `192.168.1.100`

### Step 2: Configure Frontend Environment

1. **Edit the `.env` file** in the frontend directory:
   ```bash
   cd frontend
   nano .env
   ```

2. **Update the API URL** with your host machine's IP:
   ```env
   REACT_APP_API_URL=http://192.168.1.100:8000
   ```
   Replace `192.168.1.100` with your actual host IP.

### Step 3: Restart the Frontend

```bash
cd frontend
npm start
```

The frontend will now connect to your host machine's backend.

## Alternative Solutions

### Option 1: Use Environment Variable at Runtime
```bash
REACT_APP_API_URL=http://YOUR_HOST_IP:8000 npm start
```

### Option 2: Build with Environment Variable
```bash
REACT_APP_API_URL=http://YOUR_HOST_IP:8000 npm run build
```

### Option 3: Use Dynamic Configuration
If you need to change the backend URL frequently, you can modify the API service to detect the host dynamically.

## Verify Connection

1. **Check backend is accessible** from your remote machine:
   ```bash
   curl http://YOUR_HOST_IP:8000/health/
   ```

2. **Check in browser** - visit:
   ```
   http://YOUR_HOST_IP:8000/docs
   ```

3. **Frontend should show** green "Connected" status in the top-right corner.

## Troubleshooting

### Backend Connection Error Persists
1. **Verify backend is running**:
   ```bash
   cd backend
   ./start_server.sh
   ```

2. **Check if port 8000 is accessible**:
   ```bash
   netstat -tuln | grep 8000
   ```

3. **Firewall issues** - ensure port 8000 is open:
   ```bash
   # Ubuntu/Debian
   sudo ufw allow 8000
   
   # CentOS/RHEL
   sudo firewall-cmd --add-port=8000/tcp --permanent
   sudo firewall-cmd --reload
   ```

### Wrong IP Address
- Try different network interfaces if you have multiple
- Use `ip route get 8.8.8.8` to find the primary interface
- For Docker/VM setups, you might need the Docker host IP

### CORS Issues
The backend is already configured with CORS allowing all origins, but if you encounter CORS errors, check the browser's developer console.

## Production Considerations

For production deployment:
1. Use proper domain names instead of IP addresses
2. Enable HTTPS
3. Configure proper CORS origins
4. Use environment variables for different environments

## Example Complete Setup

```bash
# 1. Get host IP
HOST_IP=$(hostname -I | awk '{print $1}')
echo "Host IP: $HOST_IP"

# 2. Configure frontend
cd frontend
echo "REACT_APP_API_URL=http://$HOST_IP:8000" > .env

# 3. Start backend
cd ../backend
./start_server.sh &

# 4. Start frontend
cd ../frontend
npm start
```

The dashboard should now be accessible from any machine on your network at `http://YOUR_HOST_IP:3000` and properly connect to the backend.