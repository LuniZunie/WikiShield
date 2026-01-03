export const welcomes = {
    "Auto": {
        title: "Auto",
        template: (user) => {

        }
    },
    "Default": {
        title: "Default",
        template: "subst:Welcome",
        sign: true
    },

    "Basic": {
        title: "Basic",
        template: "subst:W-basic",
        sign: false
    },
    "Unregistered": {
        title: "Unregistered",
        template: "subst:Welcome-unregistered",
        sign: true
    },
    "Non-Latin": {
        title: "Non-Latin",
        template: "subst:Welcome-non-latin",
        sign: true
    },

    "Vandalism fighter": {
        title: "Vandalism fighter",
        template: "subst:Welcome-vandalism fighter",
        sign: false
    },

    "Personal": {
        title: "Personal",
        template: "subst:Welcome-personal",
        sign: true
    },
    "Cookie": {
        title: "Cookie",
        template: "subst:Welcome cookie",
        sign: true
    },
    "Kitten": {
        title: "Kitten",
        template: "subst:Welcome kitten",
        sign: false
    },

    "Graphical": {
        title: "Graphical",
        template: "subst:W-graphical",
        sign: false
    },
    "Screen": {
        title: "Screen",
        template: "subst:W-screen",
        sign: false
    },

    "Autobiography": {
        title: "Autobiography",
        template: "subst:Welcome-auto",
        sign: true
    },
    "COI": {
        title: "COI",
        template: "subst:Welcome-COI",
        sign: true
    },
};

welcomes["Auto"].template = user => {
    if (mw.util.isIPAddress(user.name) || mw.util.isTemporaryUser(user.name)) {
        return "Unregistered";
    } else if (!welcomes["Non-Latin"].hide && /[^\u0000-\u007F]/.test(user.name)) {
        return "Non-Latin";
    }

    return "Default";
};