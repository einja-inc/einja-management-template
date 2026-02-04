export type Convo = {
  sender: string;
  message: string;
  timestamp: string;
};

export type ChatUser = {
  id: string;
  profile: string;
  username: string;
  fullName: string;
  title: string;
  messages: Convo[];
};

export const conversations: ChatUser[] = [
  {
    id: "conv1",
    profile: "https://randomuser.me/api/portraits/men/32.jpg",
    username: "alex_dev",
    fullName: "Alex John",
    title: "Senior Backend Dev",
    messages: [
      {
        sender: "You",
        message: "See you later, Alex!",
        timestamp: "2024-08-24T11:15:15",
      },
      {
        sender: "Alex",
        message: "Alright, talk to you later!",
        timestamp: "2024-08-24T11:11:30",
      },
      {
        sender: "You",
        message: "For sure. Anyway, I should get back to reviewing the project.",
        timestamp: "2024-08-23T09:26:50",
      },
      {
        sender: "Alex",
        message: "Yeah, let me know what you think.",
        timestamp: "2024-08-23T09:25:15",
      },
      {
        sender: "You",
        message: "Oh, nice! I've been waiting for that. I'll check it out later.",
        timestamp: "2024-08-23T09:24:30",
      },
      {
        sender: "Alex",
        message: "They've added a dark mode option! It looks really sleek.",
        timestamp: "2024-08-23T09:23:10",
      },
      {
        sender: "You",
        message: "No, not yet. What's new?",
        timestamp: "2024-08-23T09:22:00",
      },
      {
        sender: "Alex",
        message: "By the way, have you seen the new feature update?",
        timestamp: "2024-08-23T09:21:05",
      },
    ],
  },
  {
    id: "conv2",
    profile: "https://randomuser.me/api/portraits/women/44.jpg",
    username: "sarah_designer",
    fullName: "Sarah Miller",
    title: "Lead Designer",
    messages: [
      {
        sender: "You",
        message: "Thanks! Looking forward to it.",
        timestamp: "2024-08-23T14:30:00",
      },
      {
        sender: "Sarah",
        message: "I'll send you the final mockups by tomorrow.",
        timestamp: "2024-08-23T14:28:00",
      },
      {
        sender: "You",
        message: "That sounds great!",
        timestamp: "2024-08-23T14:25:00",
      },
    ],
  },
  {
    id: "conv3",
    profile: "https://randomuser.me/api/portraits/men/45.jpg",
    username: "mike_pm",
    fullName: "Mike Johnson",
    title: "Project Manager",
    messages: [
      {
        sender: "Mike",
        message: "Can we schedule a meeting for tomorrow?",
        timestamp: "2024-08-22T10:00:00",
      },
      {
        sender: "You",
        message: "Sure, what time works for you?",
        timestamp: "2024-08-22T10:05:00",
      },
      {
        sender: "Mike",
        message: "How about 2 PM?",
        timestamp: "2024-08-22T10:10:00",
      },
    ],
  },
];
