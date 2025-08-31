
# IoT Smart Classroom Dashboard

A comprehensive IoT automation system for smart classrooms with real-time device control, scheduling, and monitoring capabilities.

## 🚀 Features

- **Real-time Device Control**: Control lights, fans, projectors, and other devices via WebSocket
- **Smart Scheduling**: Automated device control based on time and calendar events
- **Advanced User Management**: Comprehensive role-based access control with admin approval workflow
- **Class Extension Requests**: Teachers can request class time extensions with authority approval
- **Security Notifications**: Real-time alerts for unauthorized access and suspicious activities
- **Permission System**: Multi-level approval workflow for user registration and access control
- **Offline Operation**: ESP32 devices work independently when backend is unavailable
- **Responsive UI**: Modern React interface with dark/light theme support
- **RESTful API**: Complete API for device management and automation
- **WebSocket Communication**: Real-time updates and device synchronization
- **Database Integration**: MongoDB with optimized queries and indexing
- **Security**: JWT authentication, input validation, CORS protection
- **Containerization**: Docker support for easy deployment

## 🔐 Permission System

### User Roles & Permissions

The system implements a hierarchical permission structure:

| Role | Permissions | Can Approve |
|------|-------------|-------------|
| **Admin** | Full system access, user management, all approvals | All requests |
| **Principal** | School-wide oversight, major approvals | Registration, role changes, extensions |
| **Dean** | Department oversight, academic approvals | Role changes, access upgrades, extensions |
| **HOD** | Department head, team approvals | Access upgrades, extensions |
| **Faculty** | Teaching staff, class management | Short extensions (≤15 min) |
| **Security** | Security monitoring, access control | N/A |
| **Student** | Basic access, device viewing | N/A |

### Approval Workflow

#### User Registration Process
1. **Registration**: User submits registration request with role and department
2. **Admin Review**: Admin reviews and approves/rejects the request
3. **Activation**: Upon approval, user account is activated with appropriate permissions
4. **Notification**: User receives email/in-app notification of approval status

#### Class Extension Process
1. **Request**: Teacher requests class time extension with justification
2. **Auto-Approval**: Extensions ≤15 minutes are automatically approved
3. **Authority Review**: Longer extensions require HOD/Dean/Principal approval
4. **Schedule Update**: Approved extensions automatically update the class schedule
5. **Notification**: All parties receive notifications of the decision

### Security Features

- **Account Approval**: All new registrations require admin approval
- **Role-Based Access**: Users can only access features appropriate to their role
- **Audit Logging**: All permission changes and approvals are logged
- **Security Alerts**: Real-time notifications for unauthorized access attempts
- **Session Management**: Secure JWT tokens with configurable expiration

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│    │  Node.js Backend │    │   MongoDB       │
│   (TypeScript)  │◄──►│  (Express)      │◄──►│   Database      │
│                 │    │                 │    │                 │
│ - Dashboard UI  │    │ - REST API      │    │ - Devices       │
│ - Real-time UI  │    │ - WebSocket     │    │ - Schedules     │
│ - User Auth     │    │ - Auth/JWT      │    │ - Users         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────┐
                    │   ESP32 Devices │
                    │   (C++/Arduino)│
                    │                 │
                    │ - Device Control│
                    │ - Offline Mode  │
                    │ - WiFi/MQTT     │
                    └─────────────────┘
```

## 📋 Prerequisites

- Node.js 18+
- MongoDB 6.0+
- Docker & Docker Compose (optional)
- ESP32 development board

## 🛠️ Quick Start

### Using Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd iot-final-main
   ```

2. **Start all services**
   ```bash
   docker-compose up -d
   ```

3. **Create Initial Admin User**
   ```bash
   cd backend
   node scripts/createInitialAdmin.js
   ```

4. **Access the application**
   - Frontend: http://localhost
   - Backend API: http://localhost:3001
   - MongoDB: localhost:27017

### Manual Installation

1. **Database Setup**
   ```bash
   # Start MongoDB
   docker run -d -p 27017:27017 --name mongodb mongo:6.0

   # Or install MongoDB locally and start service
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env  # Configure environment variables
   node scripts/createInitialAdmin.js  # Create admin user
   npm start
   ```

3. **Frontend Setup**
   ```bash
   npm install
   npm run dev
   ```

## 🧪 Testing the Permission System

### Initial Setup
```bash
# 1. Start MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:6.0

# 2. Create initial admin user
cd backend
node scripts/createInitialAdmin.js

# 3. Start backend
npm start

# 4. Start frontend
cd ..
npm run dev
```

### Testing User Registration Flow
```bash
# 1. Register a new user (will create pending request)
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@college.edu",
    "password": "password123",
    "role": "faculty",
    "department": "Computer Science",
    "employeeId": "CS001",
    "phone": "+1234567890",
    "designation": "Assistant Professor"
  }'

# 2. Login as admin (default: admin@college.edu / admin123456)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@college.edu",
    "password": "admin123456"
  }'

# 3. Get pending requests
curl -X GET http://localhost:3001/api/auth/permission-requests/pending \
  -H "Authorization: Bearer <admin-jwt-token>"

# 4. Approve the request
curl -X PUT http://localhost:3001/api/auth/permission-requests/<request-id>/approve \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"comments": "Approved - valid faculty member"}'
```

### Testing Class Extension Flow
```bash
# 1. Login as faculty user
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@college.edu",
    "password": "password123"
  }'

# 2. Request class extension
curl -X POST http://localhost:3001/api/auth/class-extensions \
  -H "Authorization: Bearer <faculty-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleId": "<schedule-id>",
    "requestedEndTime": "2024-01-15T11:30:00Z",
    "reason": "Extra time for lab demonstration",
    "roomNumber": "101",
    "subject": "Computer Science"
  }'

# 3. Check notifications
curl -X GET http://localhost:3001/api/auth/notifications \
  -H "Authorization: Bearer <faculty-jwt-token>"
```

## ⚙️ Configuration

### Environment Variables

Create `.env` file in the backend directory:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/iot-automation
NODE_ENV=development

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server
PORT=3001

# CORS (add your frontend URLs)
FRONTEND_URL=http://localhost:5173
```

### ESP32 Configuration

Update `esp32/config.h`:

```cpp
#define WIFI_SSID "YourWiFiSSID"
#define WIFI_PASSWORD "YourWiFiPassword"
#define SERVER_IP "192.168.1.100"  // Your backend IP
#define SERVER_PORT 3001
#define DEVICE_SECRET "your-device-secret"
```

## 📚 API Documentation

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "faculty"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### Permission Management

#### Get Pending Permission Requests
```http
GET /api/auth/permission-requests/pending
Authorization: Bearer <jwt-token>
```

#### Approve Permission Request
```http
PUT /api/auth/permission-requests/:requestId/approve
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "comments": "Approved - valid faculty member"
}
```

#### Reject Permission Request
```http
PUT /api/auth/permission-requests/:requestId/reject
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "rejectionReason": "Invalid department information",
  "comments": "Please verify department details"
}
```

### Class Extension Management

#### Request Class Extension
```http
POST /api/auth/class-extensions
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "scheduleId": "schedule_id_here",
  "requestedEndTime": "2024-01-15T11:30:00Z",
  "reason": "Extra time needed for lab demonstration",
  "roomNumber": "101",
  "subject": "Computer Science",
  "classDetails": {
    "semester": "6",
    "section": "A",
    "batch": "2024",
    "studentCount": 45
  }
}
```

#### Get Pending Extension Requests
```http
GET /api/auth/class-extensions/pending
Authorization: Bearer <jwt-token>
```

#### Approve Extension Request
```http
PUT /api/auth/class-extensions/:requestId/approve
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "comments": "Approved - valid academic reason"
}
```

#### Reject Extension Request
```http
PUT /api/auth/class-extensions/:requestId/reject
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "rejectionReason": "Conflicts with next scheduled class",
  "comments": "Next class starts at 11:15 AM"
}
```

### Notification Management

#### Get User Notifications
```http
GET /api/auth/notifications
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `limit` (optional): Number of notifications to return (default: 50)
- `unreadOnly` (optional): Set to "true" to get only unread notifications

#### Mark Notification as Read
```http
PUT /api/auth/notifications/:notificationId/read
Authorization: Bearer <jwt-token>
```

#### Get Unread Notification Count
```http
GET /api/auth/notifications/unread-count
Authorization: Bearer <jwt-token>
```

### Device Management

#### Get All Devices
```http
GET /api/devices
Authorization: Bearer <jwt-token>
```

#### Control Device
```http
POST /api/devices/:id/toggle
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "state": true
}
```

#### Bulk Device Control
```http
POST /api/devices/bulk-toggle
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "state": true,
  "deviceIds": ["device1", "device2"]
}
```

### Scheduling

#### Create Schedule
```http
POST /api/schedules
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "Morning Lights",
  "type": "daily",
  "time": "08:00",
  "action": "on",
  "switches": [
    {
      "deviceId": "device1",
      "switchId": "switch1"
    }
  ]
}
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
npm test
```

### Manual Testing
```bash
# Health check
curl http://localhost:3001/health

# API test
curl -X GET http://localhost:3001/api/devices \
  -H "Authorization: Bearer <your-jwt-token>"
```

## 🚀 Deployment

### Production Deployment

1. **Build and deploy**
   ```bash
   # Build frontend
   npm run build

   # Start backend
   cd backend
   npm run build  # If using TypeScript
   npm start
   ```

2. **Using Docker in production**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Environment setup**
   ```bash
   export NODE_ENV=production
   export MONGODB_URI=mongodb://prod-server:27017/iot-prod
   export JWT_SECRET=your-production-secret
   ```

### Security Checklist

- [ ] Change default JWT secret
- [ ] Configure production MongoDB credentials
- [ ] Set up HTTPS/SSL certificates
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Set up monitoring and logging
- [ ] Regular security updates

## 🔧 Development

### Code Quality

- **Linting**: `npm run lint`
- **Type checking**: `npm run type-check`
- **Testing**: `npm test`
- **Build**: `npm run build`

### Project Structure

```
├── backend/                 # Node.js API server
│   ├── controllers/         # Route controllers
│   ├── models/             # MongoDB models
│   ├── routes/             # API routes
│   ├── middleware/         # Express middleware
│   ├── services/           # Business logic
│   └── tests/              # Backend tests
├── src/                    # React frontend
│   ├── components/         # Reusable components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API services
│   └── types/              # TypeScript types
├── esp32/                  # ESP32 firmware
│   ├── main.cpp            # Main firmware
│   ├── config.h            # Configuration
│   └── functions.cpp       # Device functions
└── docker-compose.yml      # Container orchestration
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

1. **WebSocket connection fails**
   - Check backend server is running on correct port
   - Verify CORS configuration
   - Check network connectivity

2. **Database connection issues**
   - Verify MongoDB is running
   - Check connection string in `.env`
   - Ensure database user has correct permissions

3. **ESP32 not connecting**
   - Verify WiFi credentials in `config.h`
   - Check backend IP address
   - Ensure firewall allows connections on port 3001

### Logs and Debugging

```bash
# Backend logs
cd backend && npm run dev

# Frontend logs
npm run dev

# Database logs
docker logs iot-mongodb
```

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation

---

**Happy automating! 🤖**
