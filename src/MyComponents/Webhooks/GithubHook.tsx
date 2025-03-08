import React, { useEffect, useState } from "react";
import { Github, UserCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/shadcnComponents/card";
import { Badge } from "@/components/ui/shadcnComponents/badge";

// Type definitions for GitHub webhook payload
interface GitHubCommitDetail {
  id: string;
  message: string;
  author: string;
  timestamp: string;
}

interface GitHubCommitGroup {
  id: string;
  repo: string;
  branch: string;
  author: string;
  authorAvatar?: string;
  timestamp: string;
  commits: GitHubCommitDetail[];
}

interface GitHubWebhookComponentProps {
  // If you want to filter by specific repos
  repoFilter?: string[];
}

const CommitDetail: React.FC<GitHubCommitDetail> = ({ id, message, author }) => {
  return (
    <div className="flex items-start space-x-2 py-1 text-sm">
      <div className="flex-shrink-0 w-16 font-mono text-red-300">{id.substring(0, 7)}</div>
      <div className="flex-grow">
        <span className="text-white">{message}</span>
        {author && (
          <span className="text-red-400 ml-2">- {author}</span>
        )}
      </div>
    </div>
  );
};

const GitHubWebhookComponent: React.FC<GitHubWebhookComponentProps> = ({ repoFilter }) => {
  const [webhookData, setWebhookData] = useState<GitHubCommitGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Function to fetch GitHub webhook data from your backend
    const fetchGitHubWebhooks = async () => {
      try {
        setLoading(true);
        
        // Replace with your actual API endpoint
        const response = await fetch('/api/webhooks/github');
        
        if (!response.ok) {
          throw new Error(`Error fetching webhook data: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Filter by repo if specified
        const filteredData = repoFilter 
          ? data.filter((group: GitHubCommitGroup) => 
              repoFilter.some(repo => group.repo.includes(repo)))
          : data;
        
        setWebhookData(filteredData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        console.error('Error fetching GitHub webhook data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGitHubWebhooks();
    
    // Set up a polling interval to fetch new webhook data every minute
    const intervalId = setInterval(fetchGitHubWebhooks, 60000);
    
    return () => clearInterval(intervalId);
  }, [repoFilter]);

  if (loading && webhookData.length === 0) {
    return <div className="text-white text-center py-8">Loading GitHub webhook data...</div>;
  }

  if (error && webhookData.length === 0) {
    return <div className="text-red-400 text-center py-8">Error: {error}</div>;
  }

  if (webhookData.length === 0) {
    return <div className="text-gray-400 text-center py-8">No GitHub webhook data available</div>;
  }

  return (
    <>
      {webhookData.map((group) => (
        <Card key={group.id} className="mb-4 bg-black/60 border-red-950/30 overflow-hidden backdrop-blur-sm">
          <CardHeader className="p-4 flex flex-row items-center space-x-2">
            <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-800">
              <Github className="h-full w-full p-2 text-white" />
            </div>
            <div className="flex-grow">
              <CardTitle className="text-lg flex items-center">
                GitHub
                <Badge className="ml-2 bg-blue-600 hover:bg-blue-700 text-xs">APP</Badge>
                <span className="text-xs text-red-300 ml-auto">{group.timestamp}</span>
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="border-t border-red-950/30 p-4">
              <div className="flex items-center mb-2">
                <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-800 mr-2">
                  {group.authorAvatar ? (
                    <img src={group.authorAvatar} alt={group.author} className="h-full w-full object-cover" />
                  ) : (
                    <UserCircle className="h-full w-full p-1 text-gray-400" />
                  )}
                </div>
                <div className="font-medium text-white">{group.author}</div>
              </div>
              
              <div className="pl-10">
                <div className="text-blue-400 hover:underline mb-2">
                  [{group.repo}:{group.branch}] {group.commits.length} new {group.commits.length === 1 ? 'commit' : 'commits'}
                </div>
                
                {group.commits.map((commit, idx) => (
                  <CommitDetail 
                    key={idx} 
                    id={commit.id} 
                    message={commit.message}
                    author={commit.author}
                    timestamp={commit.timestamp}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
};

export default GitHubWebhookComponent;