const women = ["Ananya","Sneha","Tanvi","Diya","Meera","Priya","Riya","Shreya","Aditi","Pooja","Ishita","Kavya","Niharika","Krithi","Bhavya","Radhika","Swati","Sanjana","Neha","Vaishnavi"];
const men = ["Arjun","Rohan","Aditya","Karthik","Rahul","Nikhil","Vivek","Varun","Siddharth","Abhinav"];
const avatars = ["🌸","🦋","🌻","🪷","🌈","🍉","🦊","🐼","🌙","⭐","🍒","🌺","🐬","🍀","🦚","🍓","🌿","🪁","🧁","🎨","🦁","🐯","🐨","🐸","🦉","🐧","🐢","🐙","🦜","🐳"];
const branches = ["CSE","ISE","ECE","EEE","ME","CV","AI&ML","AI&DS"];
const bios = ["Happy to learn a few new steps and share some laughs.","Love lively music, colourful evenings and friendly company.","A little practice, a lot of smiles. See you on the floor!","Looking forward to dandiya rounds and a chai break.","Always ready for another song with kind, energetic people.","Slow steps or fast beats, let's find a rhythm together."];
const nights = [[1,2,4,7,9],[2,3,5,8],[1,4,6,7],[3,4,6,8,9],[1,2,5,7],[2,4,5,8,9]];
export const SAMPLE_DATA = [...women,...men].map((first_name,index) => ({
  slot: String(index+1).padStart(2,"0"), first_name, age:18+index%5, gender:index<20?"Woman":"Man", branch:branches[index%branches.length], year:Math.min(1+index%4,1+index%5),
  bio:bios[index%bios.length], experience:["Beginner","Intermediate","Advanced","Just for the fun 😂"][index%4],
  styles:index%3===0?["Traditional Garba","Dandiya"]:index%3===1?["Bollywood Garba","2-Taali"]:["3-Taali","Fast Garba"],
  looking_for:index%2?["Garba partner"]:["Garba partner","Friends"], available_nights:nights[index%nights.length],
  interests:index%3===0?["dance","music","reading"]:index%3===1?["travel","food","art"]:["sports","music","photography"],
  partner_preference:index%5===0?(index<20?"Men":"Women"):"Everyone",photo_path:avatars[index],
}));
