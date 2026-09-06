const notifications = [

    {
        id: 1,

        type: "goal",

        title: "Liverpool scored!",

        message:
            "Luis Diaz scored against Arsenal.",

        matchId: 1,

        time: "2 minutes ago",

        read: false,
    },


    {
        id: 2,

        type: "live",

        title: "Match is live",

        message:
            "Manchester City vs Chelsea is currently playing.",

        matchId: 4,

        time: "15 minutes ago",

        read: false,
    },


    {
        id: 3,

        type: "upcoming",

        title: "Match starting soon",

        message:
            "Real Madrid vs Atletico Madrid starts in 30 minutes.",

        matchId: 3,

        time: "30 minutes ago",

        read: true,
    },


    {
        id: 4,

        type: "result",

        title: "Full Time",

        message:
            "Barcelona defeated Sevilla 3-0.",

        matchId: 2,

        time: "Yesterday",

        read: true,
    },

];


export default notifications;