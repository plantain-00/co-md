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
    res.redirect("/login");
}

const io = socketIO(server);
const textNamespace = io.of("/text");

// room name -> socket id array
const socketIds = new Map<string, string[]>();

function leaveAll(socketId: string) {
    socketIds.forEach((ids, room) => {
        const index = ids.findIndex(s => s === socketId);
        if (index !== -1) {
            ids.splice(index, 1);
            textNamespace.to(room).emit("people count changed", ids.length);
        }
    });
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
                });
        });
        socket.on("enter", text => {
            socket.leaveAll();
            leaveAll(socket.id);

            socket.join(text);
            if (!socketIds.has(text)) {
                socketIds.set(text, [socket.id]);
            } else {
                const sockets = socketIds.get(text);
                if (sockets.findIndex(s => s === socket.id) === -1) {
                    sockets.push(socket.id);
                }
            }
            textNamespace.to(text).emit("people count changed", socketIds.get(text).length);
        });
        socket.on("disconnect", () => {
            leaveAll(socket.id);
        });
    }
});
