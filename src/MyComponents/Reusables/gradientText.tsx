import React from "react";

type GradientTextType = {
  gradient?: string
  children: React.ReactNode;
};

const GradientText = ({ gradient, children }: GradientTextType) => {
  return <div className={gradient ? `${gradient}` : 'bg-gradient-to-r from-red-500 to-red-900 bg-clip-text text-transparent font-bold'}>{children}</div>;
};

export default GradientText;
