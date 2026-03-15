export const mockSuggestions = [
{
  id: 1,
  lat: 27.7172,
  lng: 85.3240,
  title: "Sewerage overflow in Baluwatar",
  description: "The main drainage pipe near the Prime Minister's residence has been leaking for 3 days. Foul smell is spreading.",
  wada: "Kathmandu Ward 4",
  city: "Kathmandu",
  district: "Kathmandu",
  type: "Urgent",
  status: "Pending",
  upvotes: 245,
  timestamp: "2 hours ago",
  author: "Sudeep K.",
  official: {
    name: "Dinesh Maharjan",
    title: "Wada Adakshya",
    photo: "https://api.dicebear.com/7.x/pixel-art/svg?seed=dinesh",
    contact: "98510XXXXX"
  },
  mayor: {
    name: "Balendra Shah",
    photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Balen_Shah_Official_Profile.jpg/440px-Balen_Shah_Official_Profile.jpg",
    title: "Kathmandu Mayor"
  }
},
{
  id: 2,
  lat: 28.2096,
  lng: 83.9856,
  title: "Street lights missing in Lakeside",
  description: "The area near the Mandir is pitch dark after 7 PM. Dangerous for tourists and locals.",
  wada: "Pokhara Ward 6",
  city: "Pokhara",
  district: "Kaski",
  type: "Suggestion",
  status: "In Progress",
  upvotes: 120,
  timestamp: "5 hours ago",
  author: "Maya G.",
  official: {
    name: "Hari Prasad",
    title: "Wada Adakshya",
    photo: "https://api.dicebear.com/7.x/pixel-art/svg?seed=hari",
    contact: "98412XXXXX"
  },
  mayor: {
    name: "Dhanraj Acharya",
    photo: "https://api.dicebear.com/7.x/pixel-art/svg?seed=dhanraj",
    title: "Pokhara Mayor"
  }
},
{
  id: 3,
  lat: 30.2245,
  lng: 81.1245,
  title: "Border Infrastructure Development",
  description: "The roads connecting the Tinkar pass need widening to support local trade.",
  wada: "Byas Rural Municipality 1",
  city: "Byas",
  district: "Darchula",
  type: "Idea",
  status: "Pending",
  upvotes: 890,
  timestamp: "1 day ago",
  author: "Strategic Watch",
  official: {
    name: "Ashok Singh Bohara",
    title: "Wada Adakshya",
    photo: "https://api.dicebear.com/7.x/pixel-art/svg?seed=ashok",
    contact: "9868XXXXXX"
  },
  mayor: {
    name: "Mangal Singh",
    photo: "https://api.dicebear.com/7.x/pixel-art/svg?seed=mangal",
    title: "Darchula Chairperson"
  }
}];


export const getWadaProfile = (wadaName) => {


  if (wadaName.includes("Kathmandu")) return mockSuggestions[0].official;
  if (wadaName.includes("Pokhara")) return mockSuggestions[1].official;
  return mockSuggestions[2].official;
};