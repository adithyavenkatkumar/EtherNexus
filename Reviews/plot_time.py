import matplotlib.pyplot as plt
import os

# Data
operations = ["Deposit", "Standard Transfer", "Withdrawal", "Multi-Sig Initiation", "Recurring Payment"]
times = [13.2, 14.1, 14.3, 17.5, 15.0]

# Set up the figure and axis
plt.figure(figsize=(10, 6))

# Define colors 
colors = ['#8bc34a', '#03a9f4', '#cddc39', '#e91e63', '#ffc107']

# Plotting the bar chart
bars = plt.bar(operations, times, color=colors, edgecolor='black', linewidth=1.5)

# Adding titles and labels
plt.title('Transaction Confirmation Time per Operation', fontsize=16, fontweight='bold')
plt.xlabel('Smart Contract Operations', fontsize=14)
plt.ylabel('Time (seconds)', fontsize=14)

# Adding value labels on top of the bars
for bar in bars:
    yval = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2, yval + 0.2, f'{yval:.1f}', ha='center', va='bottom', fontsize=12, fontweight='bold')

# Creating a text box to satisfy the user's specific text requirement
textstr = "12–18 sec range\nMulti-signature slower\nNetwork dependency"
props = dict(boxstyle='round', facecolor='white', alpha=0.9, edgecolor='black')
plt.text(0.02, 0.95, textstr, transform=plt.gca().transAxes, fontsize=12,
        verticalalignment='top', bbox=props)

# Improve layout
plt.ylim(0, 20)
plt.xticks(rotation=15)
plt.grid(axis='y', linestyle='--', alpha=0.7)
plt.tight_layout()

# Save the plot
os.makedirs('assets', exist_ok=True)
plt.savefig('assets/transaction_time_analysis.png', dpi=300)
print("Graph saved to assets/transaction_time_analysis.png")
