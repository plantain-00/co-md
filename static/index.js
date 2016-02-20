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
        el: "#toolbar",
        data: {
            profile: null
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
        console.log(editor.session.getValue());
    }, 512, false)

    editor.session.on('change', sync);
});
