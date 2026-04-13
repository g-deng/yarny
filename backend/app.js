const express = require('express');
const cors = require('cors');
const logger = require('morgan');
require('dotenv').config();

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const projectsRouter = require('./routes/projects');
const pdfRouter = require('./routes/pdf');
const progressRouter = require('./routes/progress');
const uploadRouter = require('./routes/upload');
const commentsRouter = require('./routes/comments');

const app = express();

// Middleware
app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
app.use('/', indexRouter);
app.use('/api/users', usersRouter);
app.use('/api/users', progressRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects', pdfRouter);
app.use('/api/upload', uploadRouter);
app.use('/api', commentsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: req.app.get('env') === 'development' ? err.message : 'Internal server error',
  });
});

module.exports = app;
