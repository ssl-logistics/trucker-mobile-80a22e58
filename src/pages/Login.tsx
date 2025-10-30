const Login = () => {
  const handleLineLogin = () => {
    // TODO: Implement LINE Login
    console.log("LINE Login clicked");
    // For now, redirect to terms page
    window.location.href = "/terms";
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-between p-8">
      {/* Logo Section */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-8">
            <div className="text-white text-6xl font-bold tracking-wider">
              S S L
            </div>
            <div className="text-white text-sm tracking-widest mt-2">
              LOGISTICS COMPANY LIMITED
            </div>
            {/* Decorative curves */}
            <div className="mt-4 flex justify-center gap-1">
              <div className="h-1 w-32 bg-white rounded-full opacity-80"></div>
              <div className="h-1 w-32 bg-white rounded-full opacity-60"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Login Button */}
      <div className="w-full max-w-md mb-8">
        <button
          onClick={handleLineLogin}
          className="w-full bg-white text-gray-800 rounded-full py-4 px-6 flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors font-medium text-lg"
        >
          <div className="w-8 h-8 bg-[#06C755] rounded-full flex items-center justify-center text-white font-bold">
            L
          </div>
          Continue with LINE
        </button>
        
        <div className="text-center mt-8 text-white/70 text-sm">
          ข้อกำหนดการใช้งานและนโยบายคุ้มครองข้อมูลส่วนบุคคล
        </div>
        <div className="text-center mt-2 text-white/50 text-xs">
          V 1.0.0 (1)
        </div>
      </div>
    </div>
  );
};

export default Login;
