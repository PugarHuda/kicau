// Real singing clips per speciesId. Attribution required by license — shown in the bird card.
export type BirdVideo =
  | { kind: "file"; src: string; page: string; author: string; license: string }
  | { kind: "youtube"; id: string; page: string; author: string; license: string };

export const VIDEOS: (BirdVideo | null)[] = [
  // 0 Kenari — Commons 480p VP9 transcode (~12.3 MB, 111 s)
  {
    kind: "file",
    src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/7/7b/Serinus_canaria_forma_domestica_-_video_09_ies.webm/Serinus_canaria_forma_domestica_-_video_09_ies.webm.480p.vp9.webm",
    page: "https://commons.wikimedia.org/wiki/File:Serinus_canaria_forma_domestica_-_video_09_ies.webm",
    author: "Frank Vincentz",
    license: "CC BY-SA 3.0",
  },
  // 1 Lovebird (Agapornis fischeri)
  {
    kind: "youtube",
    id: "q9VegMDHvKo",
    page: "https://www.youtube.com/watch?v=q9VegMDHvKo",
    author: "Video Kameraku",
    license: "YouTube embed",
  },
  // 2 Murai Batu (Copsychus malabaricus)
  {
    kind: "youtube",
    id: "TuNGm01pAQs",
    page: "https://www.youtube.com/watch?v=TuNGm01pAQs",
    author: "Kms Aviary",
    license: "YouTube embed",
  },
  // 3 Cucak Rawa (Pycnonotus zeylanicus)
  {
    kind: "youtube",
    id: "YmerdZZoSwM",
    page: "https://www.youtube.com/watch?v=YmerdZZoSwM",
    author: "Birdwatch Traveller",
    license: "YouTube embed",
  },
  // 4 Jalak Bali (Leucopsar rothschildi)
  {
    kind: "youtube",
    id: "A-LPHBX0AaQ",
    page: "https://www.youtube.com/watch?v=A-LPHBX0AaQ",
    author: "Jonathan Ferrera",
    license: "YouTube embed",
  },
];
