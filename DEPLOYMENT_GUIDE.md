# Deployment Guide for Discord Clone

This guide explains how to deploy your Discord clone application to various platforms so that users can access it on the internet.

## Application Overview

This Discord clone consists of:
- Backend: Node.js with Express.js, SQLite3 for database
- Frontend: HTML, CSS, JavaScript (no frameworks)
- Authentication: JWT tokens
- Features: User registration/login, friend system, private messaging

## Prerequisites

Before deploying, ensure your application is properly configured:

1. Check that your `server.js` file contains the correct port configuration:
   ```javascript
   const PORT = process.env.PORT || 3000;
   ```

2. Make sure your server listens on all interfaces:
   ```javascript
   app.listen(PORT, '0.0.0.0', () => {
       console.log(`Server запущен на порту ${PORT}`);
   });
   ```

3. Update the JWT secret in production:
   ```javascript
   const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
   ```

## Deployment Options

### 1. Deploy to Heroku

Heroku is a great platform for Node.js applications.

#### Steps:
1. Create a Heroku account at https://heroku.com
2. Install the Heroku CLI
3. Navigate to your project directory
4. Login to Heroku: `heroku login`
5. Create a new app: `heroku create your-app-name`
6. Set the buildpack: `heroku buildpacks:set heroku/nodejs`
7. Deploy: `git push heroku main`

#### Environment Variables:
- Set your JWT secret: `heroku config:set JWT_SECRET=your-secure-jwt-secret`

### 2. Deploy to Railway

Railway is another excellent platform for Node.js applications.

#### Steps:
1. Create an account at https://railway.app
2. Install the Railway CLI or connect your GitHub repository
3. Import your project
4. Railway will automatically detect it's a Node.js app
5. Add environment variables in the dashboard
6. Deploy automatically on push to main branch

### 3. Deploy to Render

Render offers easy deployment for Node.js applications.

#### Steps:
1. Create an account at https://render.com
2. Connect your GitHub/GitLab repository
3. Select "Web Service" as the environment
4. Choose your repository
5. Set runtime to "Node"
6. Set build command to: `npm install`
7. Set start command to: `npm start`
8. Add environment variables in the dashboard

### 4. Deploy to Vercel (with modifications)

Note: Vercel primarily supports frontend applications, but you can deploy the frontend part separately.

For the backend, you'll need to use Vercel Serverless Functions or deploy to another service and update the API endpoints in your frontend files.

## Configuration for Production

### Update API endpoints
If deploying frontend and backend separately, update the API endpoint in your JavaScript files:

```javascript
// Instead of using relative paths like '/api/login'
// Use the full URL of your backend:
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-backend-domain.com/api';
```

### Database considerations
- SQLite is fine for development and low-traffic sites
- For production with higher traffic, consider PostgreSQL or MySQL
- If using Heroku/Railway/Render, use their database addons

### Package.json scripts
Make sure your package.json has the correct start script:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

## Environment Variables

Common environment variables you should set:
- `JWT_SECRET`: Secret key for JWT tokens
- `DATABASE_URL`: Connection string for your database (if using PostgreSQL/MySQL)
- `NODE_ENV`: Set to 'production'

## Custom Domain

Most platforms allow connecting custom domains:
1. Purchase a domain (if you don't have one)
2. In your hosting platform's dashboard, go to Domain settings
3. Add your custom domain
4. Follow the instructions to update DNS records with your domain registrar

## SSL Certificate

All mentioned platforms provide free SSL certificates for HTTPS access. Make sure to enable HTTPS for your domain.

## Troubleshooting

### Application crashes after deployment
- Check logs: `heroku logs --tail` (for Heroku)
- Verify all dependencies are listed in package.json
- Ensure the start script is correct

### Database connection issues
- Verify database connection strings
- For SQLite, ensure the database file is writable
- Consider using PostgreSQL for production deployments

### Static files not loading
- Verify that your Express static middleware is set up correctly:
  ```javascript
  app.use(express.static('public'));
  ```

## Scaling Considerations

For increased traffic:
- Consider moving from SQLite to PostgreSQL/MySQL
- Add caching mechanisms
- Implement load balancing if needed
- Monitor resource usage

## Security Best Practices

- Never expose JWT secrets in client-side code
- Use HTTPS for all connections
- Implement rate limiting
- Sanitize user inputs
- Regularly update dependencies

## Conclusion

Your Discord clone is now ready to be deployed to the internet! Choose the platform that best fits your needs and budget. Remember to properly configure environment variables and consider upgrading from SQLite for production use.