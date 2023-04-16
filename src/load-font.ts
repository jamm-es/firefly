export default async function loadFont() {
  const rubik = new FontFace('Rubik', 'url("https://fonts.googleapis.com/css2?family=Rubik:wght@500&display=swap")', {
    style: 'normal',
    weight: '500'
  });
  await rubik.load();
  document.fonts.add(rubik);
}