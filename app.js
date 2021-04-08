const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const { tldExists } = require('tldjs');
const exphbs = require('express-handlebars');
const { helpers } = require('./utils');
const database = require('./database');

const router = require('./routes');

const app = express();

const hbs = exphbs.create({ helpers });

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, _, next) => {
    req.db = database;

    const host = encodeURIComponent(req.get('host'));
    app.locals.host = host;
    app.locals.isICANN = tldExists(host);

    next();
});
app.use('/', router);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
