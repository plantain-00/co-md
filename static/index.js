$(function () {
    editor.session.setValue("", -1);
    setTimeout(function () {
        window.addEventListener("hashchange", function () {
            $('.ui-layout-east').scrollTop($('.ui-layout-east').scrollTop() - 6);
        }); // a little gap to top
        if (window.location.hash.length > 0) {
            $('.ui-layout-east').scrollTop($(window.location.hash).offset().top - 30); // scroll to hash element
        }
    }, 1000);

    var vue = new Vue({
        el: "#vue",
        data: {
            profile: null,
            room: "",
            roomEditing: ""
        },
        methods: {
            connect: function () {
                if (this.roomEditing) {
                    this.room = this.roomEditing.trim();
                    socket.emit("enter", this.room);
                }
            }
        }
    });

    fetch("/user", {
        credentials: 'same-origin'
    }).then(function (response) {
        return response.json()
    }).then(function (json) {
        vue.profile = json;
    }).catch(function (error) {
        console.log(error)
    });

    var sync = _.debounce(function () {
        if (vue.room) {
            socket.emit("text changed", {
                text: editor.session.getValue(),
                room: vue.room
            });
        }
    }, 512, false)

    editor.session.on('change', sync);

    socket.on("text changed", data => {
        if (data.userId !== vue.profile.id) {
            editor.session.setValue(data.text);
        }
    });
});
