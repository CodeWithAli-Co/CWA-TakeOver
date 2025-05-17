import { CompanyCreds } from "./defaultCreds";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react"; // Import the back icon

export const CooCeoCreds = () => {
  return (
    <>
    {/* I'll do this for now you can edit this later but I prefer this method rather than clicking on the folder */}
    <div className="p-4 bg-black flex items-center">
        <Link 
          to="/details" 
          className="bg-black flex justify-center items-center border p-2 pr-5 border-red-950 hover:bg-red-950 text-white hover:border-red-900 hover:text-black group"
        >
        
          <ChevronLeft className="w-5 h-5 inline-block mr-1 text-red-900 group-hover:text-black" />
          <span className=" ">Back to Default Folder</span>
        
      </Link>
      </div>
      <CompanyCreds folder="ccc" />
    </>
  );
};