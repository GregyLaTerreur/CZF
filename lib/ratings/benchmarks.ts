// Barèmes de l'IPI (Indice de Performance Individuelle), repris tels quels de l'outil « App CZF »
// (benchmarks.js, barèmes validés). Pour chaque division, rôle et stat : plancher (0), centre (50), plafond (100).
export type Threshold = { floor: number; center: number; ceiling: number };

export const IPI_BENCHMARKS: Record<string, Record<string, Record<string, Threshold>>> = {
  "Yordle": {
    "Top": {
      "KDA": {
        "floor": 1,
        "center": 2.6,
        "ceiling": 5
      },
      "GPM": {
        "floor": 320,
        "center": 356,
        "ceiling": 390
      },
      "DPM": {
        "floor": 540,
        "center": 670,
        "ceiling": 790
      },
      "CS/min": {
        "floor": 5.5,
        "center": 6.5,
        "ceiling": 7.5
      },
      "KP %": {
        "floor": 25,
        "center": 40,
        "ceiling": 55
      }
    },
    "Jungle": {
      "KDA": {
        "floor": 1.5,
        "center": 3.6,
        "ceiling": 6
      },
      "GPM": {
        "floor": 320,
        "center": 380,
        "ceiling": 420
      },
      "DPM": {
        "floor": 350,
        "center": 510,
        "ceiling": 580
      },
      "CS/min": {
        "floor": 5.5,
        "center": 6.4,
        "ceiling": 7
      },
      "KP %": {
        "floor": 50,
        "center": 60,
        "ceiling": 70
      }
    },
    "Mid": {
      "KDA": {
        "floor": 1.5,
        "center": 3.1,
        "ceiling": 5
      },
      "GPM": {
        "floor": 340,
        "center": 380,
        "ceiling": 410
      },
      "DPM": {
        "floor": 550,
        "center": 680,
        "ceiling": 800
      },
      "CS/min": {
        "floor": 5.5,
        "center": 6.5,
        "ceiling": 7.5
      },
      "KP %": {
        "floor": 45,
        "center": 55,
        "ceiling": 65
      }
    },
    "ADC": {
      "KDA": {
        "floor": 2,
        "center": 3.1,
        "ceiling": 6
      },
      "GPM": {
        "floor": 400,
        "center": 450,
        "ceiling": 500
      },
      "DPM": {
        "floor": 680,
        "center": 780,
        "ceiling": 890
      },
      "CS/min": {
        "floor": 6,
        "center": 7,
        "ceiling": 8
      },
      "KP %": {
        "floor": 45,
        "center": 55,
        "ceiling": 65
      }
    },
    "Support": {
      "KDA": {
        "floor": 1.5,
        "center": 3.6,
        "ceiling": 5
      },
      "GPM": {
        "floor": 220,
        "center": 250,
        "ceiling": 280
      },
      "DPM": {
        "floor": 150,
        "center": 220,
        "ceiling": 260
      },
      "KP %": {
        "floor": 50,
        "center": 60,
        "ceiling": 70
      },
      "Score de vision/min": {
        "floor": 2,
        "center": 2.4,
        "ceiling": 3.1
      }
    }
  },
  "Ixtal": {
    "Top": {
      "KDA": {
        "floor": 1.5,
        "center": 3.1,
        "ceiling": 5.5
      },
      "GPM": {
        "floor": 320,
        "center": 360,
        "ceiling": 395
      },
      "DPM": {
        "floor": 480,
        "center": 560,
        "ceiling": 680
      },
      "CS/min": {
        "floor": 6.5,
        "center": 7.3,
        "ceiling": 8.5
      },
      "KP %": {
        "floor": 38,
        "center": 48,
        "ceiling": 56
      }
    },
    "Jungle": {
      "KDA": {
        "floor": 2.2,
        "center": 4.3,
        "ceiling": 6.7
      },
      "GPM": {
        "floor": 320,
        "center": 370,
        "ceiling": 405
      },
      "DPM": {
        "floor": 280,
        "center": 400,
        "ceiling": 480
      },
      "CS/min": {
        "floor": 5.5,
        "center": 6.6,
        "ceiling": 7.1
      },
      "KP %": {
        "floor": 55,
        "center": 65,
        "ceiling": 75
      }
    },
    "Mid": {
      "KDA": {
        "floor": 2,
        "center": 3.6,
        "ceiling": 6
      },
      "GPM": {
        "floor": 350,
        "center": 380,
        "ceiling": 420
      },
      "DPM": {
        "floor": 550,
        "center": 630,
        "ceiling": 740
      },
      "CS/min": {
        "floor": 6.4,
        "center": 7.2,
        "ceiling": 8.4
      },
      "KP %": {
        "floor": 47,
        "center": 57,
        "ceiling": 67
      }
    },
    "ADC": {
      "KDA": {
        "floor": 2,
        "center": 3.6,
        "ceiling": 6
      },
      "GPM": {
        "floor": 430,
        "center": 470,
        "ceiling": 510
      },
      "DPM": {
        "floor": 600,
        "center": 770,
        "ceiling": 840
      },
      "CS/min": {
        "floor": 7,
        "center": 8,
        "ceiling": 9
      },
      "KP %": {
        "floor": 47,
        "center": 57,
        "ceiling": 67
      }
    },
    "Support": {
      "KDA": {
        "floor": 2.9,
        "center": 4.5,
        "ceiling": 6.9
      },
      "GPM": {
        "floor": 260,
        "center": 275,
        "ceiling": 295
      },
      "DPM": {
        "floor": 170,
        "center": 205,
        "ceiling": 260
      },
      "KP %": {
        "floor": 52,
        "center": 62,
        "ceiling": 72
      },
      "Score de vision/min": {
        "floor": 2.2,
        "center": 2.6,
        "ceiling": 3.3
      }
    }
  },
  "Targon": {
    "Top": {
      "KDA": {
        "floor": 1.75,
        "center": 3.35,
        "ceiling": 5.75
      },
      "GPM": {
        "floor": 350,
        "center": 380,
        "ceiling": 410
      },
      "DPM": {
        "floor": 560,
        "center": 680,
        "ceiling": 760
      },
      "CS/min": {
        "floor": 6.5,
        "center": 7.5,
        "ceiling": 8.5
      },
      "KP %": {
        "floor": 40,
        "center": 50,
        "ceiling": 60
      }
    },
    "Jungle": {
      "KDA": {
        "floor": 2.55,
        "center": 4.55,
        "ceiling": 5.5
      },
      "GPM": {
        "floor": 340,
        "center": 390,
        "ceiling": 420
      },
      "DPM": {
        "floor": 400,
        "center": 530,
        "ceiling": 620
      },
      "CS/min": {
        "floor": 6,
        "center": 6.75,
        "ceiling": 7.1
      },
      "KP %": {
        "floor": 58,
        "center": 68,
        "ceiling": 80
      }
    },
    "Mid": {
      "KDA": {
        "floor": 2.2,
        "center": 3.6,
        "ceiling": 6
      },
      "GPM": {
        "floor": 350,
        "center": 400,
        "ceiling": 430
      },
      "DPM": {
        "floor": 590,
        "center": 710,
        "ceiling": 805
      },
      "CS/min": {
        "floor": 6.5,
        "center": 7.4,
        "ceiling": 8.5
      },
      "KP %": {
        "floor": 53,
        "center": 63,
        "ceiling": 70
      }
    },
    "ADC": {
      "KDA": {
        "floor": 2.7,
        "center": 4.1,
        "ceiling": 6.5
      },
      "GPM": {
        "floor": 410,
        "center": 460,
        "ceiling": 490
      },
      "DPM": {
        "floor": 650,
        "center": 760,
        "ceiling": 850
      },
      "CS/min": {
        "floor": 7.5,
        "center": 8.5,
        "ceiling": 9.5
      },
      "KP %": {
        "floor": 53,
        "center": 63,
        "ceiling": 70
      }
    },
    "Support": {
      "KDA": {
        "floor": 2.4,
        "center": 4.5,
        "ceiling": 5.5
      },
      "GPM": {
        "floor": 245,
        "center": 270,
        "ceiling": 280
      },
      "DPM": {
        "floor": 190,
        "center": 215,
        "ceiling": 265
      },
      "KP %": {
        "floor": 60,
        "center": 70,
        "ceiling": 75
      },
      "Score de vision/min": {
        "floor": 2.5,
        "center": 2.9,
        "ceiling": 3.5
      }
    }
  }
};
