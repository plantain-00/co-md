/// <reference path="typings/tsd.d.ts" />

import * as express from "express";
import * as passport from "passport";
const session = require("express-session");
const GitHubStrategy = require("passport-github").Strategy;
import * as moment from "moment";
import * as socketIO from "socket.io";

import * as settings from "./settings";

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});

const strategy = new GitHubStrategy({
    clientID: settings.githubClientID,
    clientSecret: settings.githubClientSecret
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(function() {
        return done(null, profile);
    });
});

passport.use(strategy);

const app = express();

const sessionMiddleware = session({
    secret: settings.sessionSecret,
    resave: false,
    saveUninitialized: false
});

app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + "/static"));

app.get("/auth/github",
    passport.authenticate("github", { scope: [] }),
    function(req, res) {
    });

app.get("/auth/github/callback",
    passport.authenticate("github", { failureRedirect: "/" }),
    function(req, res) {
        res.redirect("/");
    });

app.get("/logout", function(req, res) {
    req.logout();
    res.redirect("/");
});

app.get("/user", function(req, res) {
    res.json(req.user);
});

const server = app.listen(settings.port);
console.log(`listening ${settings.port}`);

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login')
}

const io = socketIO(server);
const textNamespace = io.of("/text");

const rooms = new Map<string, string[]>();

function leave(socket: SocketIO.Socket) {
    if (socket.rooms && socket.rooms.length > 0) {
        const room = socket.rooms[0];
        if (rooms.has(room)) {
            const sockets = rooms.get(room);
            const index = sockets.findIndex(s => s === socket.id);
            if (index !== -1) {
                sockets.splice(index, 1);
                textNamespace.to(room).emit("people count changed", sockets.length);
            }
        }
    }
}

textNamespace.use(function(socket, next) {
    sessionMiddleware(socket.request, {}, next);
}).on("connection", socket => {
    if (socket.request.session.passport === undefined) {
        socket.disconnect(true);
    } else {
        const user = socket.request.session.passport.user;
        socket.on("text changed", data => {
            textNamespace.to(data.room)
                .emit("text changed", {
                    userId: user.id,
                    text: data.text
                })
        });
        socket.on("enter", text => {
            leave(socket);
            socket.leaveAll()
            socket.join(text);
            if (!rooms.has(text)) {
                rooms.set(text, [socket.id]);
            } else {
                const sockets = rooms.get(text);
                if (sockets.findIndex(s => s === socket.id) === -1) {
                    sockets.push(socket.id);
                }
            }
            textNamespace.to(text).emit("people count changed", rooms.get(text).length);
        });
        socket.on("disconnect", text => {
            leave(socket);
        });
    }
});
