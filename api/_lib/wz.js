// WordZ-specific room projection. (Under _lib/ so Vercel never treats it as a
// route.) Mirrors the shape the WordZ client expects; never leaks seat tokens.

function publicRoom(room) {
  return {
    code:        room.code,
    status:      room.status,
    game:        room.game,
    config:      room.config,
    maxSeats:    room.maxSeats,
    seats:       room.seats.map(s => ({ name: s.name, color: s.color })),
    state:       room.state,
    submissions: room.submissions,
    version:     room.version,
  };
}

module.exports = { publicRoom };
