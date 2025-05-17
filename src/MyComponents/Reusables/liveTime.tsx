import { useState } from "react";

const LiveTime = () => {
  const [time, setTime] = useState("");

  setInterval(() => {
    setTime(new Date().toLocaleTimeString());
  }, 1000);

  return <span>{time}</span>;
};

export default LiveTime;
