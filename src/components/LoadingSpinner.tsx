const LoadingSpinner = () => {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin-slow" />
      <p className="text-muted-foreground font-medium">מעבד את הקובץ ויוצר שאלות...</p>
    </div>
  );
};

export default LoadingSpinner;
