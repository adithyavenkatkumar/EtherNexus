import matplotlib.pyplot as plt
import os

# Data
operations = ["Deposit", "Standard Transfer", "Withdrawal", "Multi-Sig Initiation", "Recurring Payment"]
gas_costs = [50000, 65000, 55000, 80000, 70000]

# Set up the figure and axis
plt.figure(figsize=(10, 6))

# Define colors (highlighting highest and lowest)
colors = ['#4caf50', '#2196f3', '#ffeb3b', '#f44336', '#ff9800']

# Plotting the bar chart
bars = plt.bar(operations, gas_costs, color=colors, edgecolor='black', linewidth=1.5)

# Adding titles and labels
plt.title('Gas Consumption per Operation', fontsize=16, fontweight='bold')
plt.xlabel('Smart Contract Operations', fontsize=14)
plt.ylabel('Gas Cost (units)', fontsize=14)

# Adding value labels on top of the bars
for bar in bars:
    yval = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2, yval + 1000, str(int(yval)), ha='center', va='bottom', fontsize=12, fontweight='bold')

# Creating a text box to satisfy the user's specific text requirement
textstr = "Multi-signature highest\nDeposit lowest\nReason: validation complexity"
props = dict(boxstyle='round', facecolor='white', alpha=0.9, edgecolor='black')
plt.text(0.02, 0.95, textstr, transform=plt.gca().transAxes, fontsize=12,
        verticalalignment='top', bbox=props)

# Improve layout
plt.xticks(rotation=15)
plt.grid(axis='y', linestyle='--', alpha=0.7)
plt.tight_layout()

# Save the plot
os.makedirs('assets', exist_ok=True)
plt.savefig('assets/gas_consumption_analysis.png', dpi=300)
print("Graph saved to assets/gas_consumption_analysis.png")
