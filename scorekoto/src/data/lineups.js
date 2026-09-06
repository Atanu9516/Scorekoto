const lineups = [
  {
    matchId: 1,

    home: {
      team: "Liverpool",
      formation: "4-3-3",
      coach: "Arne Slot",

      startingXI: [
        { name: "Alisson Becker", number: 1, position: "GK", row: 1 },

        { name: "Trent Alexander-Arnold", number: 66, position: "RB", row: 2 },
        { name: "Ibrahima Konaté", number: 5, position: "CB", row: 2 },
        { name: "Virgil van Dijk", number: 4, position: "CB", row: 2 },
        { name: "Andrew Robertson", number: 26, position: "LB", row: 2 },

        { name: "Alexis Mac Allister", number: 10, position: "CM", row: 3 },
        { name: "Ryan Gravenberch", number: 38, position: "CM", row: 3 },
        { name: "Dominik Szoboszlai", number: 8, position: "AM", row: 3 },

        { name: "Mohamed Salah", number: 11, position: "RW", row: 4 },
        { name: "Diogo Jota", number: 20, position: "ST", row: 4 },
        { name: "Luis Diaz", number: 7, position: "LW", row: 4 },
      ],

      substitutes: [
        { name: "Caoimhin Kelleher", number: 62 },
        { name: "Joe Gomez", number: 2 },
        { name: "Curtis Jones", number: 17 },
        { name: "Harvey Elliott", number: 19 },
        { name: "Cody Gakpo", number: 18 },
      ],
    },

    away: {
      team: "Arsenal",
      formation: "4-3-3",
      coach: "Mikel Arteta",

      startingXI: [
        { name: "David Raya", number: 1, position: "GK", row: 1 },

        { name: "Ben White", number: 4, position: "RB", row: 2 },
        { name: "William Saliba", number: 2, position: "CB", row: 2 },
        { name: "Gabriel Magalhães", number: 6, position: "CB", row: 2 },
        { name: "Jurrien Timber", number: 12, position: "LB", row: 2 },

        { name: "Declan Rice", number: 41, position: "CM", row: 3 },
        { name: "Martin Ødegaard", number: 8, position: "AM", row: 3 },
        { name: "Mikel Merino", number: 23, position: "CM", row: 3 },

        { name: "Bukayo Saka", number: 7, position: "RW", row: 4 },
        { name: "Kai Havertz", number: 29, position: "ST", row: 4 },
        { name: "Gabriel Martinelli", number: 11, position: "LW", row: 4 },
      ],

      substitutes: [
        { name: "Neto", number: 32 },
        { name: "Jakub Kiwior", number: 15 },
        { name: "Jorginho", number: 20 },
        { name: "Leandro Trossard", number: 19 },
        { name: "Gabriel Jesus", number: 9 },
      ],
    },
  },

  {
    matchId: 4,

    home: {
      team: "Manchester City",
      formation: "4-2-3-1",
      coach: "Pep Guardiola",

      startingXI: [
        { name: "Ederson", number: 31, position: "GK", row: 1 },

        { name: "Kyle Walker", number: 2, position: "RB", row: 2 },
        { name: "Rúben Dias", number: 3, position: "CB", row: 2 },
        { name: "Manuel Akanji", number: 25, position: "CB", row: 2 },
        { name: "Joško Gvardiol", number: 24, position: "LB", row: 2 },

        { name: "Rodri", number: 16, position: "DM", row: 3 },
        { name: "Mateo Kovačić", number: 8, position: "DM", row: 3 },

        { name: "Bernardo Silva", number: 20, position: "RW", row: 4 },
        { name: "Kevin De Bruyne", number: 17, position: "AM", row: 4 },
        { name: "Jack Grealish", number: 10, position: "LW", row: 4 },

        { name: "Erling Haaland", number: 9, position: "ST", row: 5 },
      ],

      substitutes: [
        { name: "Stefan Ortega", number: 18 },
        { name: "John Stones", number: 5 },
        { name: "Phil Foden", number: 47 },
        { name: "Matheus Nunes", number: 27 },
        { name: "Jérémy Doku", number: 11 },
      ],
    },

    away: {
      team: "Chelsea",
      formation: "4-2-3-1",
      coach: "Enzo Maresca",

      startingXI: [
        { name: "Robert Sánchez", number: 1, position: "GK", row: 1 },

        { name: "Malo Gusto", number: 27, position: "RB", row: 2 },
        { name: "Wesley Fofana", number: 29, position: "CB", row: 2 },
        { name: "Levi Colwill", number: 6, position: "CB", row: 2 },
        { name: "Marc Cucurella", number: 3, position: "LB", row: 2 },

        { name: "Moises Caicedo", number: 25, position: "DM", row: 3 },
        { name: "Enzo Fernandez", number: 8, position: "CM", row: 3 },

        { name: "Noni Madueke", number: 11, position: "RW", row: 4 },
        { name: "Cole Palmer", number: 20, position: "AM", row: 4 },
        { name: "Pedro Neto", number: 7, position: "LW", row: 4 },

        { name: "Nicolas Jackson", number: 15, position: "ST", row: 5 },
      ],

      substitutes: [
        { name: "Filip Jørgensen", number: 12 },
        { name: "Tosin Adarabioyo", number: 4 },
        { name: "Romeo Lavia", number: 45 },
        { name: "Christopher Nkunku", number: 18 },
        { name: "Mykhailo Mudryk", number: 10 },
      ],
    },
  },
];

export default lineups;