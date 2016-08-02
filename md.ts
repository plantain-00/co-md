import * as express from "express";
import * as passport from "passport";
import * as session from "express-session";
const GitHubStrategy = require("passport-github").Strategy;
import * as socketIO from "socket.io";

import * as settings from "./settings";

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (obj, done) {
    done(null, obj);
});

const strategy = new GitHubStrategy({
    clientID: settings.githubClientID,
    clientSecret: settings.githubClientSecret,
}, (accessToken: string, refreshToken: string, profile: string, done: Function) => {
    process.nextTick(function () {
        return done(null, profile);
    });
});

passport.use(strategy);

const app = express();

const sessionMiddleware = session({
    secret: settings.sessionSecret,
    resave: false,
    saveUninitialized: false,
});

app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + "/static", {
    setHeaders: (res, path, stat) => {
        res.setHeader("Content-Security-Policy", "default-src *;script-src 'self';style-src 'self' 'unsafe-inline' 'unsafe-eval';font-src 'self' data:;img-src 'self' data:;connect-src 'self' md.yorkyao.xyz wss://md.yorkyao.xyz");
    }
}));

app.get("/auth/github",
    passport.authenticate("github", { scope: [] }),
    function (req, res) {
        // todo
    });

app.get("/auth/github/callback",
    passport.authenticate("github", { failureRedirect: "/" }),
    function (req, res) {
        res.redirect("/");
    });

app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
});

app.get("/user", function (req, res) {
    res.json(req.user);
});

const server = app.listen(settings.port);
console.log(`listening ${settings.port}`);

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

type Text = {
    text: string;
    room: string;
}

textNamespace.use(function (socket, next) {
    sessionMiddleware(socket.request, {} as any, next);
}).on("connection", socket => {
    if (socket.request.session.passport === undefined) {
        socket.disconnect(true);
    } else {
        const user = socket.request.session.passport.user;
        socket.on("text changed", (data: Text) => {
            textNamespace.to(data.room)
                .emit("text changed", {
                    userId: user.id,
                    text: data.text,
                });
        });
        socket.on("enter", (text: string) => {
            socket.leaveAll();
            leaveAll(socket.id);

            socket.join(text);
            if (!socketIds.has(text)) {
                socketIds.set(text, [socket.id]);
            } else {
                const sockets = socketIds.get(text);
                if (sockets && sockets.findIndex(s => s === socket.id) === -1) {
                    sockets.push(socket.id);
                }
            }
            textNamespace.to(text).emit("people count changed", socketIds!.get(text) !.length);
        });
        socket.on("disconnect", () => {
            leaveAll(socket.id);
        });
    }
});
