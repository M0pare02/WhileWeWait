const wyrQuestions = [
  { a: "Have the ability to fly but only at walking speed", b: "Be able to read minds but you can never turn it off" },
  { a: "Know the date of your own death", b: "Know the cause of your own death" },
  { a: "Always have to whisper", b: "Always have to shout" },
  { a: "Never be able to use the internet again", b: "Never be able to travel more than 10 miles from where you were born" },
  { a: "Have skin that changes color based on your emotions", b: "Have a voice that changes based on what you're thinking" },
  { a: "Eat only pizza for the rest of your life", b: "Eat only tacos for the rest of your life" },
  { a: "Be famous but lonely", b: "Unknown but surrounded by people who love you" },
  { a: "Be able to speak every language", b: "Be able to play every musical instrument" },
  { a: "Have to hop everywhere you go", b: "Have to moonwalk everywhere" },
  { a: "Go back in time but never return to the present", b: "Jump 10 years into the future with no way back" },
  { a: "Give up your smartphone for a year", b: "Give up coffee (or your favorite drink) for a year" },
  { a: "Have unlimited free flights anywhere", b: "Have unlimited free hotel stays anywhere" },
  { a: "Laugh uncontrollably at every funeral", b: "Cry uncontrollably at every celebration" },
  { a: "Be stuck on a long flight with a crying baby", b: "Be stuck on a long flight next to someone who won't stop talking" },
  { a: "Never have to wait in line again", b: "Never have to be stuck in traffic again" },
];

let wyrIndex = 0;

function wyrRender() {
  const q = wyrQuestions[wyrIndex];
  document.getElementById('wyr-a').textContent = q.a;
  document.getElementById('wyr-b').textContent = q.b;
  document.getElementById('wyr-count').textContent = `Question ${wyrIndex + 1} of ${wyrQuestions.length}`;
}

function wyrNext() {
  wyrIndex = (wyrIndex + 1) % wyrQuestions.length;
  wyrRender();
}

function wyrPrev() {
  wyrIndex = (wyrIndex - 1 + wyrQuestions.length) % wyrQuestions.length;
  wyrRender();
}
